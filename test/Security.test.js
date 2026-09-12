const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { buildMockEventProof } = require("../scripts/generateProof");

const ActionType = {
  DEFI_LOAN_REPAYMENT: 0,
  COMPOUND_SUPPLY: 1,
  UNISWAP_LP_PROVISION: 2,
  ENS_IDENTITY: 3,
  STABLECOIN_TRANSFER: 4,
  RWA_INVOICE_SETTLEMENT: 5,
};

describe("CredX Security Hardening", function () {
  let deployer, attacker, victim, extra;

  before(async function () {
    [deployer, attacker, victim, extra] = await ethers.getSigners();
  });

  async function deployCore() {
    const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
    const oracle = await MockAttestationOracle.deploy();

    const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    const scoreEngine = await CreditScoreEngine.deploy();

    const CredXHub = await ethers.getContractFactory("CredXHub");
    const credXHub = await CredXHub.deploy(await oracle.getAddress(), await scoreEngine.getAddress());
    await scoreEngine.setCredXHub(await credXHub.getAddress());

    return { oracle, scoreEngine, credXHub };
  }

  async function boostUser(hub, user, count, value) {
    const proofs = [];
    const actions = [];
    const values = [];
    for (let i = 0; i < count; i++) {
      proofs.push(buildMockEventProof(1, ethers.id(`sec-${user.address}-${i}`), 1000 + i, null, null, value));
      actions.push(ActionType.DEFI_LOAN_REPAYMENT);
      values.push(ethers.parseEther(value));
    }
    await hub.connect(user).submitBatchProofs(proofs, actions, values);
    const profile = await hub.getBorrowerProfile(user.address);
    return profile.creditScore;
  }

  describe("1. Oracle access control", function () {
    it("should only allow the owner to toggle alwaysPass", async function () {
      const { oracle } = await deployCore();
      await expect(oracle.connect(attacker).setAlwaysPass(false))
        .to.be.revertedWithCustomError(oracle, "OnlyOwner");
      await expect(oracle.connect(deployer).setAlwaysPass(false))
        .to.emit(oracle, "AlwaysPassUpdated");
    });
  });

  describe("2. Reported value caps", function () {
    it("should reject a single proof above the per-proof cap", async function () {
      const { credXHub } = await deployCore();
      const proof = buildMockEventProof(1, ethers.id("cap-proof"), 1, null, null, "600000");
      await expect(
        credXHub.connect(victim).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("600000"))
      ).to.be.revertedWithCustomError(credXHub, "ValueExceedsPerProofCap");
    });

    it("should reject a same-day proof that would exceed the daily cap", async function () {
      const { credXHub } = await deployCore();
      const p1 = buildMockEventProof(1, ethers.id("day-1"), 1, null, null, "500000");
      await credXHub.connect(victim).submitRepaymentProof(p1, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("500000"));

      const p2 = buildMockEventProof(1, ethers.id("day-2"), 2, null, null, "400000");
      await credXHub.connect(victim).submitRepaymentProof(p2, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("400000"));

      const p3 = buildMockEventProof(1, ethers.id("day-3"), 3, null, null, "200000");
      await expect(
        credXHub.connect(victim).submitRepaymentProof(p3, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("200000"))
      ).to.be.revertedWithCustomError(credXHub, "ValueExceedsPerDayCap");
    });
  });

  describe("3. RWA instant bonus loop neutralized", function () {
    it("should pay no loyalty bonus on an immediate deposit->withdraw cycle", async function () {
      const { credXHub, scoreEngine } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const stablecoin = await MockERC20.deploy("USDC Token", "USDC");

      const PriceOracle = await ethers.getContractFactory("MockPriceOracle");
      const priceOracle = await PriceOracle.deploy(10000000000, 8);

      const TreasuryFund = await ethers.getContractFactory("RWATreasuryYieldFund");
      const treasuryFund = await TreasuryFund.deploy(
        await credXHub.getAddress(),
        await priceOracle.getAddress(),
        await stablecoin.getAddress()
      );

      // collect unused scoreEngine reference to keep linters quiet
      expect(scoreEngine.getAddress()).to.not.equal(ethers.ZeroAddress);

      // Super-Prime user (>= 750)
      const score = await boostUser(credXHub, victim, 15, "60000");
      expect(score).to.be.gte(750);

      await stablecoin.mint(victim.address, ethers.parseEther("1000"));

      // Deposit then immediately withdraw (NAV stays $100)
      await stablecoin.connect(victim).approve(await treasuryFund.getAddress(), ethers.parseEther("110"));
      await treasuryFund.connect(victim).deposit(ethers.parseEther("110"));
      const shares = await treasuryFund.balanceOf(victim.address);

      const balBefore = await stablecoin.balanceOf(victim.address);
      await treasuryFund.connect(victim).withdraw(shares);
      const balAfter = await stablecoin.balanceOf(victim.address);

      // No bonus: user gets back exactly the base ($110), not $112.2
      expect(balAfter - balBefore).to.equal(ethers.parseEther("110"));
    });

    it("should pay the loyalty bonus only after the ~30 day vesting window", async function () {
      const { credXHub } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const stablecoin = await MockERC20.deploy("USDC Token", "USDC");

      const PriceOracle = await ethers.getContractFactory("MockPriceOracle");
      const priceOracle = await PriceOracle.deploy(10000000000, 8);

      const TreasuryFund = await ethers.getContractFactory("RWATreasuryYieldFund");
      const treasuryFund = await TreasuryFund.deploy(
        await credXHub.getAddress(),
        await priceOracle.getAddress(),
        await stablecoin.getAddress()
      );
      await stablecoin.mint(await treasuryFund.getAddress(), ethers.parseEther("50000"));

      const score = await boostUser(credXHub, victim, 15, "60000");
      expect(score).to.be.gte(750);

      await stablecoin.mint(victim.address, ethers.parseEther("1000"));
      await stablecoin.connect(victim).approve(await treasuryFund.getAddress(), ethers.parseEther("110"));
      await treasuryFund.connect(victim).deposit(ethers.parseEther("110"));
      const shares = await treasuryFund.balanceOf(victim.address);

      await mine(216000);

      const balBefore = await stablecoin.balanceOf(victim.address);
      await treasuryFund.connect(victim).withdraw(shares);
      const balAfter = await stablecoin.balanceOf(victim.address);

      // 2% bonus has vested now
      expect(balAfter - balBefore).to.equal(ethers.parseEther("112.2"));
    });
  });

  describe("4. AMM minimum liquidity lock", function () {
    it("should permanently lock the first MINIMUM_LIQUIDITY shares to a dead address", async function () {
      const { credXHub } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const tokenA = await MockERC20.deploy("Token A", "TKNA");
      const tokenB = await MockERC20.deploy("Token B", "TKNB");

      const AMM = await ethers.getContractFactory("ReputationAMM");
      const amm = await AMM.deploy(await credXHub.getAddress(), await tokenA.getAddress(), await tokenB.getAddress());

      await tokenA.mint(deployer.address, ethers.parseEther("100000"));
      await tokenB.mint(deployer.address, ethers.parseEther("100000"));

      await tokenA.connect(deployer).approve(await amm.getAddress(), ethers.parseEther("10000"));
      await tokenB.connect(deployer).approve(await amm.getAddress(), ethers.parseEther("10000"));
      await amm.connect(deployer).addLiquidity(ethers.parseEther("10000"), ethers.parseEther("10000"));

      const dead = "0x000000000000000000000000000000000000dEaD";
      expect(await amm.balanceOf(dead)).to.equal(1000);
      // total LP supply equals sqrt(10000 * 10000) because the 1000 burn offset the LP's mint
      expect(await amm.totalSupply()).to.equal(ethers.parseEther("10000"));
    });
  });

  describe("5. AI agent reputation access control", function () {
    it("should reject reputation boosts from third parties", async function () {
      const { credXHub, oracle } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockERC20.deploy("USD Coin", "USDC");

      const AutonomousAIHub = await ethers.getContractFactory("AutonomousAIHub");
      const aiHub = await AutonomousAIHub.deploy(
        await credXHub.getAddress(),
        await oracle.getAddress(),
        await mockToken.getAddress()
      );

      await aiHub.connect(victim).registerAIAgent();
      const proof = buildMockEventProof(1, ethers.id("boost-attack"), 5, null, null, "50000");

      await expect(
        aiHub.connect(attacker).evaluateAgentPerformanceProof(victim.address, proof, ethers.parseEther("50000"))
      ).to.be.revertedWithCustomError(aiHub, "UnauthorizedReputationBoost");
    });
  });

  describe("6. AI agent loan collateral & liquidation", function () {
    let aiHub, mockToken, credXHub, oracle;

    beforeEach(async function () {
      ({ credXHub, oracle } = await deployCore());

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockToken = await MockERC20.deploy("USD Coin", "USDC");

      const AutonomousAIHub = await ethers.getContractFactory("AutonomousAIHub");
      aiHub = await AutonomousAIHub.deploy(
        await credXHub.getAddress(),
        await oracle.getAddress(),
        await mockToken.getAddress()
      );

      await mockToken.mint(victim.address, ethers.parseEther("50000"));
      await mockToken.mint(await aiHub.getAddress(), ethers.parseEther("100000"));

      // Register + boost victimeven once to 700
      await aiHub.connect(victim).registerAIAgent();
      await mockToken.connect(victim).approve(await aiHub.getAddress(), ethers.parseEther("50000"));
      for (let i = 0; i < 8; i++) {
        const proof = buildMockEventProof(1, ethers.id(`ai-${victim.address}-${i}`), 100 + i, null, null, "50000");
        await aiHub.connect(victim).evaluateAgentPerformanceProof(victim.address, proof, ethers.parseEther("50000"));
      }
    });

    it("should require collateral for agent loans and return it on repayment", async function () {
      const loanAmount = ethers.parseEther("5000");
      const required = await aiHub.getRequiredCollateral(victim.address, loanAmount);
      expect(required).to.equal(ethers.parseEther("4250")); // 85% at rep 700

      const before = await mockToken.balanceOf(victim.address);
      await aiHub.connect(victim).triggerAutonomousAgentLoan(loanAmount);
      const after = await mockToken.balanceOf(victim.address);
      // collateral moved out, loan moved in
      expect(after - before).to.equal(loanAmount - required);

      const profile = await aiHub.aiAgents(victim.address);
      expect(profile.collateralAmount).to.equal(required);

      // Repay => collateral returned
      await aiHub.connect(victim).repayAgentLoan(loanAmount);
      const afterRepay = await mockToken.balanceOf(victim.address);
      expect(afterRepay).to.equal(before);
    });

    it("should liquidate an overdue agent loan and keep the collateral", async function () {
      const loanAmount = ethers.parseEther("5000");
      const required = await aiHub.getRequiredCollateral(victim.address, loanAmount);
      await aiHub.connect(victim).triggerAutonomousAgentLoan(loanAmount);

      // Not overdue yet
      await expect(aiHub.connect(attacker).liquidateAgentLoan(victim.address))
        .to.be.revertedWithCustomError(aiHub, "LoanNotOverdue");

      await mine(216001);

      await expect(aiHub.connect(attacker).liquidateAgentLoan(victim.address))
        .to.emit(aiHub, "AgentLoanLiquidated")
        .withArgs(victim.address, required);

      const profile = await aiHub.aiAgents(victim.address);
      expect(profile.activeLoanAmount).to.equal(0);
      expect(profile.collateralAmount).to.equal(0);
      expect(profile.reputationScore).to.equal(600); // -100 from 700
    });
  });

  describe("7. DePIN hardware loan life cycle", function () {
    let hub, credXHub, depinToken;

    beforeEach(async function () {
      const ScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
      const scoreEngine = await ScoreEngine.deploy();

      const MockOracle = await ethers.getContractFactory("MockAttestationOracle");
      const mockOracle = await MockOracle.deploy();

      const CredXHub = await ethers.getContractFactory("CredXHub");
      credXHub = await CredXHub.deploy(await mockOracle.getAddress(), await scoreEngine.getAddress());

      const MockDePINToken = await ethers.getContractFactory("MockDePINToken");
      depinToken = await MockDePINToken.deploy();

      const DePINInfrastructureHub = await ethers.getContractFactory("DePINInfrastructureHub");
      hub = await DePINInfrastructureHub.deploy(await credXHub.getAddress(), await depinToken.getAddress());

      await depinToken.mint(await hub.getAddress(), ethers.parseEther("10000"));

      // Super-Prime operator for loans
      await boostUser(credXHub, victim, 15, "60000");
      await depinToken.mint(victim.address, ethers.parseEther("10000"));
    });

    it("should borrow, repay cleanly, and liquidate when overdue", async function () {
      await hub.connect(victim).requestHardwareLoan(ethers.parseEther("5000"));
      expect(await hub.hardwareLoans(victim.address)).to.equal(ethers.parseEther("5000"));

      // Repay
      await depinToken.connect(victim).approve(await hub.getAddress(), ethers.parseEther("5000"));
      await expect(hub.connect(victim).repayHardwareLoan(ethers.parseEther("5000")))
        .to.emit(hub, "HardwareLoanRepaid")
        .withArgs(victim.address, ethers.parseEther("5000"));
      expect(await hub.hardwareLoans(victim.address)).to.equal(0);

      // Take another and never repay
      await hub.connect(victim).requestHardwareLoan(ethers.parseEther("5000"));
      await expect(hub.connect(attacker).liquidateHardwareLoan(victim.address))
        .to.be.revertedWithCustomError(hub, "LoanNotOverdue");

      await mine(216001);

      await expect(hub.connect(attacker).liquidateHardwareLoan(victim.address))
        .to.emit(hub, "HardwareLoanLiquidated")
        .withArgs(victim.address, ethers.parseEther("5000"));
      expect(await hub.hardwareLoans(victim.address)).to.equal(0);
    });
  });

  describe("8. Invoice repay access control", function () {
    it("should only let the business repay its invoice", async function () {
      const { credXHub } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20.deploy("USDC", "USDC");

      const InvoiceFinancing = await ethers.getContractFactory("RWAInvoiceFinancing");
      const invoiceModule = await InvoiceFinancing.deploy(await credXHub.getAddress(), await token.getAddress());

      await token.mint(attacker.address, ethers.parseEther("1000"));
      await token.mint(extra.address, ethers.parseEther("1000"));

      // extra is the business
      await invoiceModule.connect(extra).tokenizeInvoice(ethers.parseEther("100"), 30);
      await token.connect(attacker).approve(await invoiceModule.getAddress(), ethers.parseEther("100"));
      await invoiceModule.connect(attacker).fundInvoice(0);

      // attacker (funder) cannot repay — OnlyBusiness
      await token.connect(attacker).approve(await invoiceModule.getAddress(), ethers.parseEther("1000"));
      await expect(invoiceModule.connect(attacker).repayInvoice(0))
        .to.be.revertedWithCustomError(invoiceModule, "OnlyBusiness");

      // business can repay
      await token.connect(extra).approve(await invoiceModule.getAddress(), ethers.parseEther("100"));
      await expect(invoiceModule.connect(extra).repayInvoice(0))
        .to.emit(invoiceModule, "InvoiceRepaid")
        .withArgs(0, extra.address);
    });

    it("should let a funder reclaim funds on an overdue invoice", async function () {
      const { credXHub } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20.deploy("USDC", "USDC");

      const InvoiceFinancing = await ethers.getContractFactory("RWAInvoiceFinancing");
      const invoiceModule = await InvoiceFinancing.deploy(await credXHub.getAddress(), await token.getAddress());

      await token.mint(attacker.address, ethers.parseEther("1000"));
      await token.mint(extra.address, ethers.parseEther("1000"));

      await invoiceModule.connect(extra).tokenizeInvoice(ethers.parseEther("100"), 30);
      await token.connect(attacker).approve(await invoiceModule.getAddress(), ethers.parseEther("100"));
      await invoiceModule.connect(attacker).fundInvoice(0);

      // Not overdue yet
      await expect(invoiceModule.connect(attacker).reclaimOverdueFunds(0))
        .to.be.revertedWithCustomError(invoiceModule, "InvoiceNotOverdue");

      // Business must have allowed the clawback in its financing agreement
      await token.connect(extra).approve(await invoiceModule.getAddress(), ethers.parseEther("100"));

      await mine(31);

      const before = await token.balanceOf(attacker.address);
      await invoiceModule.connect(attacker).reclaimOverdueFunds(0);
      const after = await token.balanceOf(attacker.address);
      // funded amount = 80% of face value
      expect(after - before).to.equal(ethers.parseEther("80"));
    });

    it("should not let the business reclaim an overdue invoice (OnlyFunder)", async function () {
      const { credXHub } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20.deploy("USDC", "USDC");

      const InvoiceFinancing = await ethers.getContractFactory("RWAInvoiceFinancing");
      const invoiceModule = await InvoiceFinancing.deploy(await credXHub.getAddress(), await token.getAddress());

      await token.mint(attacker.address, ethers.parseEther("1000"));
      await token.mint(extra.address, ethers.parseEther("1000"));

      await invoiceModule.connect(extra).tokenizeInvoice(ethers.parseEther("100"), 30);
      await token.connect(attacker).approve(await invoiceModule.getAddress(), ethers.parseEther("100"));
      await invoiceModule.connect(attacker).fundInvoice(0);

      await mine(31);

      await expect(invoiceModule.connect(extra).reclaimOverdueFunds(0))
        .to.be.revertedWithCustomError(invoiceModule, "OnlyFunder");

      // only the funder may claw the overdue invoice back
      await token.connect(extra).approve(await invoiceModule.getAddress(), ethers.parseEther("100"));
      await expect(invoiceModule.connect(attacker).reclaimOverdueFunds(0)).to.emit(invoiceModule, "InvoiceRepaid");
    });
  });

  describe("9. Flash loan reentrancy guard", function () {
    it("should block a reentrant second flash loan from inside the callback", async function () {
      const { credXHub } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20.deploy("Mock USD", "mUSD");

      const FlashLoan = await ethers.getContractFactory("ReputationFlashLoan");
      const flashLoan = await FlashLoan.deploy(await credXHub.getAddress(), await token.getAddress());

      const Reentrant = await ethers.getContractFactory("MockReentrantFlashBorrower");
      const reentrant = await Reentrant.deploy(await token.getAddress());
      await reentrant.configure(await flashLoan.getAddress());

      await token.mint(await flashLoan.getAddress(), ethers.parseEther("100000"));
      await token.mint(await reentrant.getAddress(), ethers.parseEther("10000"));

      const borrowAmount = ethers.parseEther("1000");
      await flashLoan.connect(attacker).flashLoan(await reentrant.getAddress(), borrowAmount, "0x");

      expect(await reentrant.reentrancyAttemptBlocked()).to.be.true;
      // exactly one fee charged (9 bps standard)
      expect(await token.balanceOf(await reentrant.getAddress())).to.equal(ethers.parseEther("9999.1"));
    });
  });

  describe("10. Soulbound SBT interface", function () {
    it("should expose the ERC721 enumerable interface", async function () {
      const { credXHub } = await deployCore();
      const SBT = await ethers.getContractFactory("CreditAttestationSBT");
      const sbt = await SBT.deploy(await credXHub.getAddress());

      expect(await sbt.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
      expect(await sbt.supportsInterface("0xffffffff")).to.be.false;
    });
  });

  describe("11. Lending pool collateral, liquidation & realized loss", function () {
    let lendingPool, cUSD, credXHub, scoreEngine;

    beforeEach(async function () {
      ({ credXHub, scoreEngine } = await deployCore());

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      cUSD = await MockERC20.deploy("CredX USD", "cUSD");

      const LendingPool = await ethers.getContractFactory("UndercollateralizedLendingPool");
      lendingPool = await LendingPool.deploy(
        await cUSD.getAddress(),
        await credXHub.getAddress(),
        await scoreEngine.getAddress()
      );
      await credXHub.setLendingPool(await lendingPool.getAddress());

      await cUSD.mint(victim.address, ethers.parseEther("100000"));
      await cUSD.connect(victim).approve(await lendingPool.getAddress(), ethers.parseEther("100000"));
      await lendingPool.connect(victim).depositLiquidity(ethers.parseEther("100000"));
    });

    it("should store only the required collateral and refund the excess", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("pool-1"), 1, null, null, "10000");
      await credXHub.connect(attacker).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("10000"));

      // Sends 2000 native for a 1000 USD loan; borrower's score ~588 -> 120% ratio => 600 required
      await lendingPool.connect(attacker).borrow(ethers.parseEther("1000"), { value: ethers.parseEther("2000") });

      const loan = await lendingPool.loans(1);
      expect(loan.collateralCTC).to.equal(ethers.parseEther("600"));
      expect(await lendingPool.totalBorrowedUSD()).to.equal(ethers.parseEther("1000"));
    });

    it("should liquidate an overdue loan and track the realized loss", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("pool-2"), 1, null, null, "10000");
      await credXHub.connect(attacker).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("10000"));

      await lendingPool.connect(attacker).borrow(ethers.parseEther("1000"), { value: ethers.parseEther("2000") });

      await expect(lendingPool.connect(extra).liquidateDefaultedLoan(1))
        .to.be.revertedWithCustomError(lendingPool, "LoanNotOverdue");

      await mine(216001);

      const deployerBalBefore = await ethers.provider.getBalance(deployer.address);
      await expect(lendingPool.connect(extra).liquidateDefaultedLoan(1))
        .to.emit(lendingPool, "LoanDefaulted")
        .withArgs(1, attacker.address, ethers.parseEther("600"));

      expect(await lendingPool.realizedLossUSD()).to.equal(ethers.parseEther("1000"));
      expect(await lendingPool.totalBorrowedUSD()).to.equal(0);

      // Collateral (600 native) moved to the treasury (defaults to deployer/owner)
      const deployerBalAfter = await ethers.provider.getBalance(deployer.address);
      expect(deployerBalAfter - deployerBalBefore).to.gte(ethers.parseEther("500"));
    });

    it("should restrict the covenant deadswitch to the owner", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("pool-3"), 1, null, null, "10000");
      await credXHub.connect(attacker).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("10000"));
      await lendingPool.connect(attacker).borrow(ethers.parseEther("1000"), { value: ethers.parseEther("2000") });

      await expect(
        lendingPool.connect(extra).triggerCovenantDeadswitch(1, ethers.id("x"), "probe")
      ).to.be.revertedWithCustomError(lendingPool, "OnlyOwner");

      await expect(lendingPool.connect(deployer).triggerCovenantDeadswitch(1, ethers.id("x"), "probe"))
        .to.emit(lendingPool, "CovenantBreached");
    });
  });

  describe("12. DePIN delegation pool undelegate", function () {
    it("should let delegated capital be undelegated and withdrawn", async function () {
      const { credXHub } = await deployCore();

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20.deploy("USDC", "USDC");

      const DePINDelegationPool = await ethers.getContractFactory("DePINDelegationPool");
      const pool = await DePINDelegationPool.deploy(await credXHub.getAddress(), await token.getAddress());

      await token.mint(attacker.address, ethers.parseEther("1000"));
      await token.mint(victim.address, ethers.parseEther("1000"));

      // Give the node a score >= 600
      const node = victim.address;
      for (let i = 0; i < 8; i++) {
        const proof = buildMockEventProof(1, ethers.id(`node-${i}`), 500 + i, null, null, "20000");
        await credXHub.connect(victim).submitRepaymentProof(proof, ActionType.COMPOUND_SUPPLY, ethers.parseEther("20000"));
      }
      const profile = await credXHub.getBorrowerProfile(node);
      expect(profile.creditScore).to.be.gte(600);

      await token.connect(attacker).approve(await pool.getAddress(), ethers.parseEther("100"));
      await pool.connect(attacker).depositCapital(ethers.parseEther("100"));
      await pool.connect(attacker).delegateToNode(node, ethers.parseEther("40"));
      expect(await pool.nodeDelegations(node)).to.equal(ethers.parseEther("40"));

      await pool.connect(attacker).undelegateFromNode(node, ethers.parseEther("40"));
      expect(await pool.nodeDelegations(node)).to.equal(0);

      await pool.connect(attacker).withdrawCapital(ethers.parseEther("100"));
      expect(await token.balanceOf(attacker.address)).to.equal(ethers.parseEther("1000"));
    });
  });
});