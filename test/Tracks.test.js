const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("../scripts/generateProof");

describe("BUIDL CTC 2026 Fall: Multi-Track Extension", function () {
  let deployer, user1, user2, aiAgent, nodeOperator;
  let oracle, scoreEngine, credXHub, mockToken, mockNFT;
  let rwaModule, depinModule, gamingModule, aiModule;

  const ActionType = {
    DEFI_LOAN_REPAYMENT: 0,
    RWA_INVOICE_SETTLEMENT: 5,
  };

  before(async function () {
    [deployer, user1, user2, aiAgent, nodeOperator] = await ethers.getSigners();

    // Deploy core protocol
    const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
    oracle = await MockAttestationOracle.deploy();

    const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    scoreEngine = await CreditScoreEngine.deploy();

    const CredXHub = await ethers.getContractFactory("CredXHub");
    credXHub = await CredXHub.deploy(await oracle.getAddress(), await scoreEngine.getAddress());
    await scoreEngine.setCredXHub(await credXHub.getAddress());

    // Deploy Mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("USDC", "USDC");
    await mockToken.mint(user1.address, ethers.parseEther("100000"));
    await mockToken.mint(user2.address, ethers.parseEther("100000"));

    const MockERC721 = await ethers.getContractFactory("MockERC721");
    mockNFT = await MockERC721.deploy("GameItem", "ITEM");
    await mockNFT.mint(deployer.address); // tokenId 0

    // Deploy Track Modules
    const RWA = await ethers.getContractFactory("RWAInvoiceFinancing");
    rwaModule = await RWA.deploy(await credXHub.getAddress(), await mockToken.getAddress());

    const DePIN = await ethers.getContractFactory("DePINDelegationPool");
    depinModule = await DePIN.deploy(await credXHub.getAddress(), await mockToken.getAddress());

    const Gaming = await ethers.getContractFactory("GamingScholarshipVault");
    gamingModule = await Gaming.deploy(await credXHub.getAddress());

    const AI = await ethers.getContractFactory("AIRiskOracle");
    aiModule = await AI.deploy(aiAgent.address);

    // Bootstrap User1 with high credit score (prime+)
    for (let i = 0; i < 5; i++) {
          const proof = await buildMockEventProof(1, "tx-" + user1.address + i);
        await credXHub.connect(user1).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("100000"));
    }
  });

  describe("RWA Track: Invoice Financing", function () {
    it("should allow a business to tokenize an invoice", async function () {
      await rwaModule.connect(user2).tokenizeInvoice(ethers.parseEther("1000"), 30);
      const invoice = await rwaModule.invoices(0);
      expect(invoice.faceValue).to.equal(ethers.parseEther("1000"));
      expect(invoice.business).to.equal(user2.address);
    });

    it("should allow a high-score user to fund at a discounted rate", async function () {
      await mockToken.connect(user1).approve(await rwaModule.getAddress(), ethers.parseEther("10000"));
      await rwaModule.connect(user1).fundInvoice(0);
      
      const invoice = await rwaModule.invoices(0);
      expect(invoice.isFunded).to.be.true;
      expect(invoice.funder).to.equal(user1.address);
    });

    it("should let the business repay the full face value to end the invoice", async function () {
      // user2 is the business of invoice 0, user1 the funder
      const invoice = await rwaModule.invoices(0);
      expect(invoice.isRepaid).to.be.false;

      await mockToken.connect(user2).approve(await rwaModule.getAddress(), ethers.parseEther("10000"));
      await expect(rwaModule.connect(user2).repayInvoice(0))
        .to.emit(rwaModule, "InvoiceRepaid")
        .withArgs(0, user2.address);

      const repaid = await rwaModule.invoices(0);
      expect(repaid.isRepaid).to.be.true;
    });
  });

  describe("DePIN Track: Hardware Delegation Pool", function () {
    it("should prevent delegation to nodes with low scores", async function () {
      await mockToken.connect(user1).approve(await depinModule.getAddress(), ethers.parseEther("1000"));
      await depinModule.connect(user1).depositCapital(ethers.parseEther("100"));
      
      await expect(
        depinModule.connect(user1).delegateToNode(nodeOperator.address, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(depinModule, "NodeScoreTooLow");
    });

    it("should allow delegation to nodes with high scores", async function () {
      // Bootstrap nodeOperator score
      for (let i = 0; i < 5; i++) {
          const proof = await buildMockEventProof(1, "tx-" + nodeOperator.address + i);
          await credXHub.connect(nodeOperator).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("100000"));
      }

      await depinModule.connect(user1).delegateToNode(nodeOperator.address, ethers.parseEther("50"));
      expect(await depinModule.nodeDelegations(nodeOperator.address)).to.equal(ethers.parseEther("50"));
    });
  });

  describe("Gaming Track: Zero-Collateral Scholarship", function () {
    it("should let guild deposit NFT", async function () {
      await mockNFT.connect(deployer).approve(await gamingModule.getAddress(), 0);
      await gamingModule.connect(deployer).depositNFT(await mockNFT.getAddress(), 0);
      expect(await mockNFT.ownerOf(0)).to.equal(await gamingModule.getAddress());
    });

    it("should prevent low score users from borrowing", async function () {
      await expect(
        gamingModule.connect(user2).borrowNFT(await mockNFT.getAddress(), 0)
      ).to.be.revertedWithCustomError(gamingModule, "ScoreTooLowForScholarship");
    });

    it("should let high score users borrow without collateral", async function () {
      await gamingModule.connect(user1).borrowNFT(await mockNFT.getAddress(), 0);
      expect(await mockNFT.ownerOf(0)).to.equal(user1.address);
    });
  });

  describe("AI Track: Autonomous Risk Oracle", function () {
    it("should prevent non-AI agents from updating risk", async function () {
      await expect(
        aiModule.connect(user1).updateRiskParameters(2000, 500)
      ).to.be.revertedWithCustomError(aiModule, "NotAIAgent");
    });

    it("should let AI agent update risk and calculate adjusted APR", async function () {
      // Volatility: 2000 (20%), Default Rate: 500 (5%)
      await aiModule.connect(aiAgent).updateRiskParameters(2000, 500);
      
      const apr = await aiModule.getAdjustedBaseAPR();
      // Base (500) + Volatility Premium (2000/10=200) + Default Premium (500) = 1200 bps
      expect(apr).to.equal(1200n);
    });
  });
});
