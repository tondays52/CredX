const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DePINInfrastructureHub", function () {
    let depinToken, hub, credXHub, mockOracle;
    let owner, standardOperator, primeOperator, superPrimeOperator, delegator;

    beforeEach(async function () {
        [owner, standardOperator, primeOperator, superPrimeOperator, delegator] = await ethers.getSigners();

        // 1. Deploy Score Engine and Mock Attestation Oracle
        const ScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
        const scoreEngine = await ScoreEngine.deploy();

        const MockOracle = await ethers.getContractFactory("MockAttestationOracle");
        mockOracle = await MockOracle.deploy();

        // 2. Deploy CredXHub
        const CredXHub = await ethers.getContractFactory("CredXHub");
        credXHub = await CredXHub.deploy(await mockOracle.getAddress(), await scoreEngine.getAddress());

        // 3. Deploy Mock DePIN Token
        const MockDePINToken = await ethers.getContractFactory("MockDePINToken");
        depinToken = await MockDePINToken.deploy();

        // 4. Deploy DePIN Hub
        const DePINInfrastructureHub = await ethers.getContractFactory("DePINInfrastructureHub");
        hub = await DePINInfrastructureHub.deploy(await credXHub.getAddress(), await depinToken.getAddress());

        const { buildMockEventProof } = require("../scripts/generateProof");

        // Prime Operator setup -> Score >= 700 but < 750
        for (let i = 0; i < 3; i++) {
            const proof = await buildMockEventProof(1, "tx-depin1-" + primeOperator.address + i);
            await credXHub.connect(primeOperator).submitRepaymentProof(proof, 0, ethers.parseEther("1000000"));
        }
        const primeProfile = await credXHub.getBorrowerProfile(primeOperator.address);

        // Super-Prime Operator setup -> Score >= 750
        for (let i = 0; i < 25; i++) {
            const proof2 = await buildMockEventProof(1, "tx-depin2-" + superPrimeOperator.address + i);
            await credXHub.connect(superPrimeOperator).submitRepaymentProof(proof2, 0, ethers.parseEther("1000000"));
        }

        // Give delegator some tokens
        await depinToken.mint(delegator.address, ethers.parseEther("1000"));
        await depinToken.connect(delegator).approve(await hub.getAddress(), ethers.parseEther("1000"));

        // Give the hub some liquidity so it can issue loans
        await depinToken.mint(await hub.getAddress(), ethers.parseEther("10000"));
    });

    describe("Automated Staking Delegation", function () {
        it("Reverts if operator score < 700", async function () {
            await expect(
                hub.connect(delegator).delegateStake(standardOperator.address, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(hub, "OperatorReliabilityTooLow");
        });

        it("Allows delegation to Prime operator (score >= 700)", async function () {
            await expect(
                hub.connect(delegator).delegateStake(primeOperator.address, ethers.parseEther("100"))
            ).to.emit(hub, "StakeDelegated")
             .withArgs(delegator.address, primeOperator.address, ethers.parseEther("100"));

            expect(await hub.delegations(delegator.address, primeOperator.address)).to.equal(ethers.parseEther("100"));
            expect(await depinToken.balanceOf(await hub.getAddress())).to.equal(ethers.parseEther("10100"));
        });
    });

    describe("Hardware Financing", function () {
        it("Reverts if operator score < 750", async function () {
            await expect(
                hub.connect(primeOperator).requestHardwareLoan(ethers.parseEther("5000"))
            ).to.be.revertedWithCustomError(hub, "InsufficientScoreForLoan");
        });

        it("Allows hardware loan for Super-Prime operator (score >= 750)", async function () {
            await expect(
                hub.connect(superPrimeOperator).requestHardwareLoan(ethers.parseEther("5000"))
            ).to.emit(hub, "HardwareLoanIssued")
             .withArgs(superPrimeOperator.address, ethers.parseEther("5000"));

            expect(await hub.hardwareLoans(superPrimeOperator.address)).to.equal(ethers.parseEther("5000"));
            expect(await depinToken.balanceOf(superPrimeOperator.address)).to.equal(ethers.parseEther("5000"));
        });
    });
});
