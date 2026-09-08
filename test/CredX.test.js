const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("../scripts/generateProof");

describe("CredX Protocol — Full Test Suite (v2: OCCR + Multi-Protocol + Batch + SBT)", function () {
  let deployer, borrower, borrower2, lender;
  let oracle, scoreEngine, credXHub, cUSD, lendingPool, sbt;

  // Action type enum values
  const ActionType = {
    DEFI_LOAN_REPAYMENT: 0,
    COMPOUND_SUPPLY: 1,
    UNISWAP_LP_PROVISION: 2,
    ENS_IDENTITY: 3,
    STABLECOIN_TRANSFER: 4,
    RWA_INVOICE_SETTLEMENT: 5,
    STAKING_COLLATERAL_LOCK: 6,
    ONCHAIN_IDENTITY_VERIFIED: 7,
  };

  beforeEach(async function () {
    [deployer, borrower, borrower2, lender] = await ethers.getSigners();

    // 1. Deploy Mock Attestation Oracle
    const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
    oracle = await MockAttestationOracle.deploy();

    // 2. Deploy CreditScoreEngine
    const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    scoreEngine = await CreditScoreEngine.deploy();

    // 3. Deploy CredXHub
    const CredXHub = await ethers.getContractFactory("CredXHub");
    credXHub = await CredXHub.deploy(await oracle.getAddress(), await scoreEngine.getAddress());
    await scoreEngine.setCredXHub(await credXHub.getAddress());

    // 4. Deploy cUSD
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    cUSD = await MockERC20.deploy("CredX USD", "cUSD");

    // 5. Deploy LendingPool
    const LendingPool = await ethers.getContractFactory("UndercollateralizedLendingPool");
    lendingPool = await LendingPool.deploy(
      await cUSD.getAddress(),
      await credXHub.getAddress(),
      await scoreEngine.getAddress()
    );
    await credXHub.setLendingPool(await lendingPool.getAddress());

    // 6. Deploy CreditAttestationSBT
    const SBT = await ethers.getContractFactory("CreditAttestationSBT");
    sbt = await SBT.deploy(await credXHub.getAddress());
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 1: Baseline OCCR Multi-Factor Scoring
  // ═══════════════════════════════════════════════════════════════════════
  describe("1. OCCR Multi-Factor Credit Scoring", function () {
    it("should assign MIN_SCORE (300) for a new borrower", async function () {
      const profile = await credXHub.getBorrowerProfile(borrower.address);
      expect(profile.creditScore).to.equal(300);
    });

    it("should increase score with a single DeFi loan repayment proof", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("tx1"), 19283746, null, null, "5000");
      const tx = await credXHub.connect(borrower).submitRepaymentProof(
        proof,
        ActionType.DEFI_LOAN_REPAYMENT,
        ethers.parseEther("5000")
      );
      const receipt = await tx.wait();

      const profile = await credXHub.getBorrowerProfile(borrower.address);
      expect(profile.creditScore).to.be.gt(300);
      expect(profile.totalAttestationsCount).to.equal(1);
    });

    it("should boost score with protocol diversity", async function () {
      // Submit 3 different protocol types
      const proof1 = buildMockEventProof(11155111, ethers.id("tx-aave"), 100, null, null, "2000");
      const proof2 = buildMockEventProof(11155111, ethers.id("tx-compound"), 101, null, null, "2000");
      const proof3 = buildMockEventProof(11155111, ethers.id("tx-uniswap"), 102, null, null, "2000");

      await credXHub.connect(borrower).submitRepaymentProof(proof1, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("2000"));
      await credXHub.connect(borrower).submitRepaymentProof(proof2, ActionType.COMPOUND_SUPPLY, ethers.parseEther("2000"));
      await credXHub.connect(borrower).submitRepaymentProof(proof3, ActionType.UNISWAP_LP_PROVISION, ethers.parseEther("2000"));

      const profileMulti = await credXHub.getBorrowerProfile(borrower.address);

      // Compare with a single-protocol borrower (same total volume)
      const proof4 = buildMockEventProof(11155111, ethers.id("tx-single1"), 200, null, null, "6000");
      await credXHub.connect(borrower2).submitRepaymentProof(proof4, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("6000"));

      const profileSingle = await credXHub.getBorrowerProfile(borrower2.address);

      // Multi-protocol borrower should have higher score due to diversity bonus
      expect(profileMulti.creditScore).to.be.gt(profileSingle.creditScore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 2: Multi-Protocol Action Types with Weighted Scoring
  // ═══════════════════════════════════════════════════════════════════════
  describe("2. Multi-Protocol Reputation Aggregation", function () {
    it("should track and weight all 8 action types correctly", async function () {
      const actionProofs = [
        { action: ActionType.DEFI_LOAN_REPAYMENT, txId: "aave-repay", value: "10000" },
        { action: ActionType.COMPOUND_SUPPLY, txId: "comp-supply", value: "8000" },
        { action: ActionType.UNISWAP_LP_PROVISION, txId: "uni-lp", value: "5000" },
        { action: ActionType.ENS_IDENTITY, txId: "ens-reg", value: "100" },
        { action: ActionType.STABLECOIN_TRANSFER, txId: "usdc-xfer", value: "15000" },
      ];

      for (const ap of actionProofs) {
        const proof = buildMockEventProof(11155111, ethers.id(ap.txId), 100 + ap.action, null, null, ap.value);
        await credXHub.connect(borrower).submitRepaymentProof(proof, ap.action, ethers.parseEther(ap.value));
      }

      const extended = await credXHub.getBorrowerProfileExtended(borrower.address);
      expect(extended.protocolDiversity).to.equal(5);
      expect(extended.totalAttestationsCount).to.equal(5);
      expect(extended.weightedActionScore).to.be.gt(0);
      expect(extended.creditScore).to.be.gt(500); // Diversified borrower should have solid score
    });

    it("should correctly read action weights from CreditScoreEngine", async function () {
      const repaymentWeight = await scoreEngine.getActionWeight(ActionType.DEFI_LOAN_REPAYMENT);
      const rwaWeight = await scoreEngine.getActionWeight(ActionType.RWA_INVOICE_SETTLEMENT);
      const ensWeight = await scoreEngine.getActionWeight(ActionType.ENS_IDENTITY);

      expect(repaymentWeight).to.equal(15000); // 1.5x
      expect(rwaWeight).to.equal(18000);       // 1.8x (highest)
      expect(ensWeight).to.equal(5000);         // 0.5x (lowest)
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 3: Attestcoin Replay Protection
  // ═══════════════════════════════════════════════════════════════════════
  describe("3. Attestcoin Replay Protection", function () {
    it("should reject duplicate proof submissions", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("tx-dup"), 5555, null, null, "1000");
      await credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"));
      
      await expect(
        credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"))
      ).to.be.revertedWith("Proof already processed (replay blocked)");
    });

    it("should reject when attestation oracle returns invalid", async function () {
      await oracle.setAlwaysPass(false);
      const proof = buildMockEventProof(11155111, ethers.id("tx-invalid"), 9999, null, null, "500");
      
      await expect(
        credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("500"))
      ).to.be.revertedWith("Attestcoin verification failed: Invalid cryptographic proof");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 4: Batch Proof Import ("Import Your Credit History in 1 Click")
  // ═══════════════════════════════════════════════════════════════════════
  describe("4. Batch Proof Import", function () {
    it("should import multiple proofs in a single transaction", async function () {
      const proofs = [];
      const actions = [];
      const values = [];

      for (let i = 0; i < 5; i++) {
        proofs.push(buildMockEventProof(11155111, ethers.id(`batch-tx-${i}`), 1000 + i, null, null, "3000"));
        actions.push(i); // Different action types for each
        values.push(ethers.parseEther("3000"));
      }

      const tx = await credXHub.connect(borrower).submitBatchProofs(proofs, actions, values);
      const receipt = await tx.wait();

      const profile = await credXHub.getBorrowerProfile(borrower.address);
      expect(profile.totalAttestationsCount).to.equal(5);
      expect(profile.totalVerifiedVolumeUSD).to.equal(ethers.parseEther("15000")); // 5 * 3000
      expect(profile.creditScore).to.be.gt(500); // Should have a substantial score after 5 proofs
    });

    it("should skip already-processed proofs in batch (no revert)", async function () {
      // First submit a single proof
      const proof0 = buildMockEventProof(11155111, ethers.id("batch-dup-0"), 2000, null, null, "1000");
      await credXHub.connect(borrower).submitRepaymentProof(proof0, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"));

      // Now batch submit including the same proof + a new one
      const proofs = [
        proof0, // Duplicate — should be skipped
        buildMockEventProof(11155111, ethers.id("batch-dup-1"), 2001, null, null, "2000"),
      ];

      await credXHub.connect(borrower).submitBatchProofs(
        proofs,
        [ActionType.DEFI_LOAN_REPAYMENT, ActionType.COMPOUND_SUPPLY],
        [ethers.parseEther("1000"), ethers.parseEther("2000")]
      );

      const profile = await credXHub.getBorrowerProfile(borrower.address);
      expect(profile.totalAttestationsCount).to.equal(2); // Only 2 unique proofs processed
    });

    it("should enforce batch size limit (max 20)", async function () {
      const proofs = [];
      const actions = [];
      const values = [];
      for (let i = 0; i < 21; i++) {
        proofs.push(buildMockEventProof(11155111, ethers.id(`big-batch-${i}`), 3000 + i, null, null, "100"));
        actions.push(ActionType.DEFI_LOAN_REPAYMENT);
        values.push(ethers.parseEther("100"));
      }

      await expect(
        credXHub.connect(borrower).submitBatchProofs(proofs, actions, values)
      ).to.be.revertedWith("Batch: 1-20 proofs allowed");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 5: Dynamic APR Tiers (Score → Interest Rate)
  // ═══════════════════════════════════════════════════════════════════════
  describe("5. Dynamic APR Tiers", function () {
    it("should return correct APR for each credit tier", async function () {
      expect(await scoreEngine.getInterestRate(800)).to.equal(250);   // Super-Prime: 2.5%
      expect(await scoreEngine.getInterestRate(700)).to.equal(500);   // Prime: 5.0%
      expect(await scoreEngine.getInterestRate(550)).to.equal(800);   // Near-Prime: 8.0%
      expect(await scoreEngine.getInterestRate(400)).to.equal(1200);  // Subprime: 12.0%
    });

    it("should give Super-Prime borrowers lower APR on actual loans", async function () {
      // Build a Super-Prime borrower with high volume + diversity
      const batchProofs = [];
      const batchActions = [];
      const batchValues = [];

      for (let i = 0; i < 15; i++) {
        batchProofs.push(buildMockEventProof(1, ethers.id(`prime-tx-${i}`), 5000 + i, null, null, "10000"));
        batchActions.push(i % 5); // Rotate through 5 action types
        batchValues.push(ethers.parseEther("10000"));
      }

      await credXHub.connect(borrower).submitBatchProofs(batchProofs, batchActions, batchValues);

      const profile = await credXHub.getBorrowerProfile(borrower.address);
      expect(profile.creditScore).to.be.gte(700); // Should be Prime or Super-Prime

      // Fund the lending pool
      const lendingPoolAddress = await lendingPool.getAddress();
      await cUSD.transfer(lender.address, ethers.parseEther("100000"));
      await cUSD.connect(lender).approve(lendingPoolAddress, ethers.parseEther("100000"));
      await lendingPool.connect(lender).depositLiquidity(ethers.parseEther("100000"));

      // Borrow and check the interest rate is lower
      const borrowAmount = ethers.parseEther("1000");
      const requiredCollateral = ethers.parseEther("500"); // Should need less collateral at high score
      
      const loanId = await lendingPool.connect(borrower).borrow.staticCall(borrowAmount, { value: requiredCollateral });
      await lendingPool.connect(borrower).borrow(borrowAmount, { value: requiredCollateral });

      const loan = await lendingPool.loans(loanId);
      expect(loan.interestRateBps).to.be.lte(500); // 5% or lower for Prime+
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 6: Credit Attestation SBT (Soulbound Token)
  // ═══════════════════════════════════════════════════════════════════════
  describe("6. Credit Attestation SBT", function () {
    it("should mint an SBT proving credit tier", async function () {
      // Build some credit history first
      const proof = buildMockEventProof(11155111, ethers.id("sbt-test"), 7777, null, null, "5000");
      await credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("5000"));

      // Mint SBT
      const tx = await sbt.connect(borrower).mintAttestation();
      await tx.wait();

      const attestation = await sbt.getAttestation(borrower.address);
      expect(attestation.holder).to.equal(borrower.address);
      expect(attestation.isValid).to.be.true;
      expect(attestation.minimumScore).to.be.gte(300);
    });

    it("should reject zero address in constructor", async function () {
      const SBT = await ethers.getContractFactory("CreditAttestationSBT");
      await expect(SBT.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(SBT, "ZeroAddress");
    });

    it("should prevent transfer of SBT (soulbound)", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("sbt-notransfer"), 8888, null, null, "1000");
      await credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"));
      await sbt.connect(borrower).mintAttestation();

      await expect(
        sbt.connect(borrower).transferFrom(borrower.address, borrower2.address, 1)
      ).to.be.revertedWithCustomError(sbt, "NonTransferable");
    });

    it("should verify attestation tier for external protocols", async function () {
      // Build Prime-tier borrower
      const proofs = [];
      const actions = [];
      const values = [];
      for (let i = 0; i < 5; i++) {
        proofs.push(buildMockEventProof(1, ethers.id(`verify-tx-${i}`), 9000 + i, null, null, "10000"));
        actions.push(i % 3);
        values.push(ethers.parseEther("10000"));
      }
      await credXHub.connect(borrower).submitBatchProofs(proofs, actions, values);
      await sbt.connect(borrower).mintAttestation();

      // Verify: should be at least NEAR_PRIME (tier 1)
      const isNearPrime = await sbt.verifyAttestation(borrower.address, 1); // CreditTier.NEAR_PRIME
      expect(isNearPrime).to.be.true;

      // Non-holder should fail verification
      const nonHolderCheck = await sbt.verifyAttestation(borrower2.address, 0);
      expect(nonHolderCheck).to.be.false;
    });

    it("should allow refreshing attestation after score changes", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("sbt-refresh-init"), 10000, null, null, "1000");
      await credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"));
      await sbt.connect(borrower).mintAttestation();

      const attBefore = await sbt.getAttestation(borrower.address);

      // Add more credit history
      const proof2 = buildMockEventProof(1, ethers.id("sbt-refresh-boost"), 10001, null, null, "50000");
      await credXHub.connect(borrower).submitRepaymentProof(proof2, ActionType.RWA_INVOICE_SETTLEMENT, ethers.parseEther("50000"));

      // Refresh
      await sbt.connect(borrower).refreshAttestation();
      const attAfter = await sbt.getAttestation(borrower.address);

      expect(attAfter.minimumScore).to.be.gte(attBefore.minimumScore);
    });

    it("should allow owner to revoke an attestation and emit AttestationRevoked", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("sbt-revoke"), 10500, null, null, "2000");
      await credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("2000"));
      await sbt.connect(borrower).mintAttestation();

      const tokenId = await sbt.holderTokenId(borrower.address);
      await expect(sbt.connect(deployer).revokeAttestation(borrower.address))
        .to.emit(sbt, "AttestationRevoked")
        .withArgs(tokenId, borrower.address);

      const isVerified = await sbt.verifyAttestation(borrower.address, 0);
      expect(isVerified).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 7: Credit Delegation (Social Lending / Co-signing)
  // ═══════════════════════════════════════════════════════════════════════
  describe("7. Credit Delegation / Social Lending", function () {
    it("should allow Prime+ user to delegate credit boost", async function () {
      // Build a Prime borrower (score >= 700)
      const batchProofs = [];
      const batchActions = [];
      const batchValues = [];
      for (let i = 0; i < 10; i++) {
        batchProofs.push(buildMockEventProof(1, ethers.id(`deleg-tx-${i}`), 11000 + i, null, null, "10000"));
        batchActions.push(i % 4);
        batchValues.push(ethers.parseEther("10000"));
      }
      await credXHub.connect(borrower).submitBatchProofs(batchProofs, batchActions, batchValues);

      const delegatorProfile = await credXHub.getBorrowerProfile(borrower.address);
      expect(delegatorProfile.creditScore).to.be.gte(700);

      // Delegate 50 CTS points to borrower2 for 30 days
      await credXHub.connect(borrower).delegateCredit(borrower2.address, 50, 30);

      const delegation = await credXHub.delegatedBoosts(borrower2.address);
      expect(delegation.delegator).to.equal(borrower.address);
      expect(delegation.boostAmount).to.equal(50);
      expect(delegation.isActive).to.be.true;
    });

    it("should apply delegation boost to beneficiary's next proof", async function () {
      // Setup delegator with high score
      const batchProofs = [];
      const batchActions = [];
      const batchValues = [];
      for (let i = 0; i < 10; i++) {
        batchProofs.push(buildMockEventProof(1, ethers.id(`deleg-boost-tx-${i}`), 12000 + i, null, null, "10000"));
        batchActions.push(i % 4);
        batchValues.push(ethers.parseEther("10000"));
      }
      await credXHub.connect(borrower).submitBatchProofs(batchProofs, batchActions, batchValues);
      await credXHub.connect(borrower).delegateCredit(borrower2.address, 80, 30);

      // borrower2 submits a proof — should get delegation boost
      const proof = buildMockEventProof(11155111, ethers.id("boosted-proof"), 13000, null, null, "1000");
      await credXHub.connect(borrower2).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"));

      const boostedProfile = await credXHub.getBorrowerProfile(borrower2.address);

      // Compare with unboosted: submit same proof to a 3rd signer (deployer acts as control)
      const proof2 = buildMockEventProof(11155111, ethers.id("unboosted-proof"), 13001, null, null, "1000");
      await credXHub.connect(deployer).submitRepaymentProof(proof2, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("1000"));

      const unboostedProfile = await credXHub.getBorrowerProfile(deployer.address);

      expect(boostedProfile.creditScore).to.be.gt(unboostedProfile.creditScore);
    });

    it("should reject delegation from low-score users", async function () {
      // borrower has no credit history (score = 300)
      await expect(
        credXHub.connect(borrower).delegateCredit(borrower2.address, 50, 30)
      ).to.be.revertedWithCustomError(credXHub, "InsufficientDelegatorScore");
    });

    it("should reject self-delegation", async function () {
      await expect(
        credXHub.connect(borrower).delegateCredit(borrower.address, 50, 30)
      ).to.be.revertedWithCustomError(credXHub, "CannotSelfDelegate");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 8: Privacy Commitment Hashes
  // ═══════════════════════════════════════════════════════════════════════
  describe("8. Privacy Commitment Hashes", function () {
    it("should store privacy commitment in attestation history", async function () {
      const proof = buildMockEventProof(11155111, ethers.id("privacy-tx"), 15000, null, null, "5000");
      await credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("5000"));

      const history = await credXHub.getBorrowerHistory(borrower.address);
      expect(history.length).to.equal(1);
      expect(history[0].privacyCommitment).to.not.equal(ethers.ZeroHash);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 9: Under-Collateralized Lending with Dynamic APR
  // ═══════════════════════════════════════════════════════════════════════
  describe("9. Under-Collateralized Lending", function () {
    it("should allow borrowing and repayment at dynamic rates", async function () {
      // Build credit history
      const proof = buildMockEventProof(11155111, ethers.id("lend-test"), 20000, null, null, "10000");
      await credXHub.connect(borrower).submitRepaymentProof(proof, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("10000"));

      // Fund pool
      const poolAddr = await lendingPool.getAddress();
      await cUSD.transfer(lender.address, ethers.parseEther("50000"));
      await cUSD.connect(lender).approve(poolAddr, ethers.parseEther("50000"));
      await lendingPool.connect(lender).depositLiquidity(ethers.parseEther("50000"));

      // Borrow
      const borrowAmt = ethers.parseEther("1000");
      await lendingPool.connect(borrower).borrow(borrowAmt, { value: ethers.parseEther("1000") });

      const loan = await lendingPool.loans(1);
      expect(loan.principalUSD).to.equal(borrowAmt);
      expect(loan.isRepaid).to.be.false;

      // Repay
      await cUSD.mint(borrower.address, ethers.parseEther("2000"));
      await cUSD.connect(borrower).approve(poolAddr, ethers.parseEther("2000"));
      await lendingPool.connect(borrower).repayLoan(1, ethers.parseEther("2000"));

      const repaidLoan = await lendingPool.loans(1);
      expect(repaidLoan.isRepaid).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TEST 10: Chain Diversity Tracking
  // ═══════════════════════════════════════════════════════════════════════
  describe("10. Chain Diversity Tracking", function () {
    it("should track proofs from multiple source chains", async function () {
      // Proof from Sepolia (11155111)
      const proof1 = buildMockEventProof(11155111, ethers.id("chain-sep"), 30000, null, null, "5000");
      await credXHub.connect(borrower).submitRepaymentProof(proof1, ActionType.DEFI_LOAN_REPAYMENT, ethers.parseEther("5000"));

      // Proof from Mainnet (1)
      const proof2 = buildMockEventProof(1, ethers.id("chain-main"), 30001, null, null, "5000");
      await credXHub.connect(borrower).submitRepaymentProof(proof2, ActionType.COMPOUND_SUPPLY, ethers.parseEther("5000"));

      const extended = await credXHub.getBorrowerProfileExtended(borrower.address);
      expect(extended.chainDiversity).to.equal(2);
      expect(extended.protocolDiversity).to.equal(2);
    });
  });
});
