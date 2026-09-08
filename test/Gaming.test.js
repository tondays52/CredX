const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("GamingEcosystemHub", function () {
    let credXHub;
    let scoreEngine;
    let gameToken;
    let gameItem;
    let hub;

    let owner, primeUser, standardUser, sybilUser;

    beforeEach(async function () {
        [owner, primeUser, standardUser, sybilUser] = await ethers.getSigners();

        // 1. Deploy Core Protocol
        const ScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
        scoreEngine = await ScoreEngine.deploy();

        const MockOracle = await ethers.getContractFactory("MockAttestationOracle");
        const mockOracle = await MockOracle.deploy();

        const CredXHub = await ethers.getContractFactory("CredXHub");
        credXHub = await CredXHub.deploy(await mockOracle.getAddress(), await scoreEngine.getAddress());
        await scoreEngine.setCredXHub(await credXHub.getAddress());

        const { buildMockEventProof } = require("../scripts/generateProof");
        const ActionType = {
            DEFI_LOAN_REPAYMENT: 0
        };

        // Boost Prime User to Score >= 750
        for (let i = 0; i < 20; i++) {
            const proof = await buildMockEventProof(1, "tx-game1-" + primeUser.address + i);
            await credXHub.connect(primeUser).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("200000"));
        }

        // Boost Standard User to Score >= 500 (but < 750)
        for (let i = 0; i < 8; i++) {
            const proof = await buildMockEventProof(1, "tx-game2-" + standardUser.address + i);
            await credXHub.connect(standardUser).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"));
        }

        // Sybil User: No profile / Score < 500
        // We will leave sybilUser unregistered (score will be 0)

        // 3. Deploy Mocks
        const GameToken = await ethers.getContractFactory("MockGameToken");
        gameToken = await GameToken.deploy();

        const GameItem = await ethers.getContractFactory("MockGameItem");
        gameItem = await GameItem.deploy();

        // 4. Deploy GamingEcosystemHub
        const GamingHub = await ethers.getContractFactory("GamingEcosystemHub");
        hub = await GamingHub.deploy(
            await credXHub.getAddress(),
            await gameToken.getAddress(),
            await gameItem.getAddress()
        );

        // 5. Transfer Ownership of mocks to Hub so it can mint
        await gameToken.transferOwnership(await hub.getAddress());
        await gameItem.transferOwnership(await hub.getAddress());
    });

    describe("Daily Gathering (Pixels)", function () {
        it("Standard user gathers base amount", async function () {
            await hub.connect(standardUser).gatherResources();
            const balance = await gameToken.balanceOf(standardUser.address);
            expect(balance).to.equal(ethers.parseEther("10")); // Base is 10 WOOD
        });

        it("Super-Prime user gathers 3x amount", async function () {
            await hub.connect(primeUser).gatherResources();
            const balance = await gameToken.balanceOf(primeUser.address);
            expect(balance).to.equal(ethers.parseEther("30")); // 3x multiplier
        });

        it("Sybil user gathers base amount but with no score", async function () {
            await hub.connect(sybilUser).gatherResources();
            const balance = await gameToken.balanceOf(sybilUser.address);
            expect(balance).to.equal(ethers.parseEther("10")); // Base fallback
        });

        it("Enforces 1 day cooldown", async function () {
            await hub.connect(primeUser).gatherResources();
            await expect(hub.connect(primeUser).gatherResources()).to.be.revertedWith("Gather cooldown active");

            // Fast forward 1 day
            await time.increase(86400);

            await hub.connect(primeUser).gatherResources();
            const balance = await gameToken.balanceOf(primeUser.address);
            expect(balance).to.equal(ethers.parseEther("60")); // Gathered twice
        });
    });

    describe("Anti-Sybil Fair Lootbox", function () {
        it("Reverts if user score is < 500", async function () {
            await expect(hub.connect(sybilUser).openLootbox()).to.be.revertedWith("Score too low for lootbox");
        });

        it("Allows Standard and Prime users to open lootboxes", async function () {
            await expect(hub.connect(standardUser).openLootbox()).to.emit(hub, "LootboxOpened");
            expect(await gameItem.balanceOf(standardUser.address)).to.equal(1);

            await expect(hub.connect(primeUser).openLootbox()).to.emit(hub, "LootboxOpened");
            expect(await gameItem.balanceOf(primeUser.address)).to.equal(1);
        });
    });

    describe("Zero-Fee Marketplace (IMX)", function () {
        let tokenId;
        const price = ethers.parseEther("100");

        beforeEach(async function () {
            // Give prime user some WOOD to buy
            await hub.connect(primeUser).gatherResources(); // Gives 30 WOOD
            // Need to mock mint more for the test manually since the Hub owns it now.
            // Oh, we can just use another contract or fast forward time.
            // Let's just do a workaround: we deploy another mock game token and swap ownership later?
            // Actually, we can just let sybilUser gather 10 days worth, or just add a direct mint to mock.
            // Since we can't easily mint, let's just make the price 10 WOOD.
        });

        it("Standard user pays 2% fee when buying", async function () {
            // PrimeUser gets an item
            await hub.connect(primeUser).openLootbox();
            tokenId = 0; // First item minted

            // PrimeUser lists it for 10 WOOD
            await gameItem.connect(primeUser).approve(await hub.getAddress(), tokenId);
            await hub.connect(primeUser).listNFT(tokenId, ethers.parseEther("10"));

            // Standard user gets 10 WOOD
            await hub.connect(standardUser).gatherResources();
            
            // Standard user approves WOOD spending
            await gameToken.connect(standardUser).approve(await hub.getAddress(), ethers.parseEther("10"));

            // Standard user buys
            await expect(hub.connect(standardUser).buyNFT(tokenId))
                .to.emit(hub, "ItemBought")
                .withArgs(standardUser.address, primeUser.address, tokenId, ethers.parseEther("10"), ethers.parseEther("0.2")); // 2% of 10 is 0.2

            // Prime User should receive 9.8 WOOD on top of the 30 WOOD they already gathered
            expect(await gameToken.balanceOf(primeUser.address)).to.equal(ethers.parseEther("39.8"));
            
            // Hub should keep 0.2 WOOD fee
            expect(await gameToken.balanceOf(await hub.getAddress())).to.equal(ethers.parseEther("0.2"));
            
            // Standard user should have 0 WOOD left and own the NFT
            expect(await gameToken.balanceOf(standardUser.address)).to.equal(0);
            expect(await gameItem.ownerOf(tokenId)).to.equal(standardUser.address);
        });

        it("Super-Prime user pays 0% fee when buying", async function () {
            // StandardUser gets an item
            await hub.connect(standardUser).openLootbox();
            tokenId = 0;

            // StandardUser lists it for 10 WOOD
            await gameItem.connect(standardUser).approve(await hub.getAddress(), tokenId);
            await hub.connect(standardUser).listNFT(tokenId, ethers.parseEther("10"));

            // Prime user approves WOOD spending (they already have 30 WOOD from beforeEach)
            await gameToken.connect(primeUser).approve(await hub.getAddress(), ethers.parseEther("10"));

            // Prime user buys
            await expect(hub.connect(primeUser).buyNFT(tokenId))
                .to.emit(hub, "ItemBought")
                .withArgs(primeUser.address, standardUser.address, tokenId, ethers.parseEther("10"), 0); // 0 fee

            // Standard User should receive 10 WOOD
            expect(await gameToken.balanceOf(standardUser.address)).to.equal(ethers.parseEther("10"));
            
            // Hub should keep 0 fee
            expect(await gameToken.balanceOf(await hub.getAddress())).to.equal(0);
            
            // Prime user should have 20 WOOD left and own the NFT
            expect(await gameToken.balanceOf(primeUser.address)).to.equal(ethers.parseEther("20"));
            expect(await gameItem.ownerOf(tokenId)).to.equal(primeUser.address);
        });
    });
});
