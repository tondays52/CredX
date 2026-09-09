const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("../scripts/generateProof");

describe("AI Track: AutonomousAIHub (Oracle-less Cross-Chain Verification)", function () {
  let deployer, requester, gpuProvider, aiAgent, regularUser;
  let mockToken, oracle, scoreEngine, credXHub, aiHub;

  beforeEach(async function () {
    [deployer, requester, gpuProvider, aiAgent, regularUser] = await ethers.getSigners();

    // 1. Deploy Mock Attestation Oracle (USC / Attestcoin Engine)
    const MockAttestationOracle = await ethers.getContractFactory("MockAttestationOracle");
    oracle = await MockAttestationOracle.deploy();

    // 2. Deploy Score Engine & CredXHub
    const CreditScoreEngine = await ethers.getContractFactory("CreditScoreEngine");
    scoreEngine = await CreditScoreEngine.deploy();

    const CredXHub = await ethers.getContractFactory("CredXHub");
    credXHub = await CredXHub.deploy(await oracle.getAddress(), await scoreEngine.getAddress());
    await scoreEngine.setCredXHub(await credXHub.getAddress());

    // 3. Deploy Settlement Token (USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("USD Coin", "USDC");

    // 4. Deploy AutonomousAIHub
    const AutonomousAIHub = await ethers.getContractFactory("AutonomousAIHub");
    aiHub = await AutonomousAIHub.deploy(
      await credXHub.getAddress(),
      await oracle.getAddress(),
      await mockToken.getAddress()
    );

    // Fund accounts & pool
    await mockToken.mint(requester.address, ethers.parseEther("50000"));
    await mockToken.mint(aiAgent.address, ethers.parseEther("50000"));
    await mockToken.mint(await aiHub.getAddress(), ethers.parseEther("100000")); // Pool liquidity
  });

  describe("1. Oracle-less Cross-Chain Risk Ingestion", function () {
    it("should autonomously adjust risk parameters upon verified multi-chain proof", async function () {
      const proof = buildMockEventProof(1, "0x" + "a".repeat(64), 18000000, null, null, "100000");

      const initialApr = await aiHub.getAutonomousRiskAdjustedAPR();
      expect(initialApr).to.equal(500 + (1000 / 10) + 200); // 800 bps (8%)

      // Ingest cross-chain volatility spike signal (volatility = 3000 (30%), default = 500 (5%))
      await expect(aiHub.processCrossChainRiskSignal(proof, 3000, 500))
        .to.emit(aiHub, "CrossChainRiskSignalProcessed")
        .withArgs(proof.sourceChainId, proof.txHash, 3000, 500, 1300);

      const newApr = await aiHub.getAutonomousRiskAdjustedAPR();
      expect(newApr).to.equal(1300); // 500 + 300 + 500 = 1300 bps (13%)
    });

    it("should prevent replay of the same cross-chain risk proof", async function () {
      const proof = buildMockEventProof(1, "0x" + "b".repeat(64), 18000001, null, null, "100000");
      await aiHub.processCrossChainRiskSignal(proof, 2000, 300);

      await expect(
        aiHub.processCrossChainRiskSignal(proof, 2000, 300)
      ).to.be.revertedWithCustomError(aiHub, "ProofAlreadyProcessed");
    });

    it("should reject invalid cryptographic state proofs", async function () {
      await oracle.setAlwaysPass(false);
      const proof = buildMockEventProof(1, "0x" + "c".repeat(64), 18000002, null, null, "100000");

      await expect(
        aiHub.processCrossChainRiskSignal(proof, 2000, 300)
      ).to.be.revertedWithCustomError(aiHub, "CryptographicProofInvalid");
    });
  });

  describe("2. Autonomous AI Agent Credit Lines (AgentFi)", function () {
    it("should register an AI agent with base reputation 300", async function () {
      await aiHub.connect(aiAgent).registerAIAgent();
      const profile = await aiHub.aiAgents(aiAgent.address);
      expect(profile.isRegistered).to.be.true;
      expect(profile.reputationScore).to.equal(300);
    });

    it("should reject loans for AI agents below Prime threshold (700)", async function () {
      await aiHub.connect(aiAgent).registerAIAgent();
      await expect(
        aiHub.connect(aiAgent).triggerAutonomousAgentLoan(ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(aiHub, "ScoreBelowThreshold");
    });

    it("should boost agent reputation via verified performance proofs and dispatch loans", async function () {
      await aiHub.connect(aiAgent).registerAIAgent();

      // Submit 8 verified cross-chain profit proofs to boost score from 300 -> 700
      for (let i = 0; i < 8; i++) {
        const proof = buildMockEventProof(1, "0x" + i.toString().padStart(64, "0"), 18000000 + i, null, null, "50000");
        await aiHub.evaluateAgentPerformanceProof(aiAgent.address, proof, ethers.parseEther("50000"));
      }

      const profile = await aiHub.aiAgents(aiAgent.address);
      expect(profile.reputationScore).to.be.gte(700);

      // Now AI agent triggers undercollateralized loan
      const loanAmount = ethers.parseEther("5000");
      const agentBalBefore = await mockToken.balanceOf(aiAgent.address);

      await expect(aiHub.connect(aiAgent).triggerAutonomousAgentLoan(loanAmount))
        .to.emit(aiHub, "AgentLoanDispatched")
        .withArgs(aiAgent.address, loanAmount);

      const agentBalAfter = await mockToken.balanceOf(aiAgent.address);
      expect(agentBalAfter - agentBalBefore).to.equal(loanAmount);

      // Repay loan
      await mockToken.connect(aiAgent).approve(await aiHub.getAddress(), loanAmount);
      await expect(aiHub.connect(aiAgent).repayAgentLoan(loanAmount))
        .to.emit(aiHub, "AgentLoanRepaid")
        .withArgs(aiAgent.address, loanAmount);

      const updatedProfile = await aiHub.aiAgents(aiAgent.address);
      expect(updatedProfile.activeLoanAmount).to.equal(0);
      expect(updatedProfile.totalLoansRepaid).to.equal(loanAmount);
    });
  });

  describe("3. Verifiable Proof-of-Compute Settlement (GPU / Task Lease)", function () {
    const taskId = ethers.keccak256(ethers.toUtf8Bytes("LLAMA-3-70B-FINE-TUNE-TASK-001"));
    const escrowAmount = ethers.parseEther("2500");

    it("should deposit compute escrow and settle autonomously upon verified proof", async function () {
      // 1. Requester deposits escrow for GPU provider
      await mockToken.connect(requester).approve(await aiHub.getAddress(), escrowAmount);
      await expect(aiHub.connect(requester).depositComputeEscrow(taskId, gpuProvider.address, escrowAmount))
        .to.emit(aiHub, "ComputeEscrowDeposited")
        .withArgs(taskId, requester.address, gpuProvider.address, escrowAmount);

      const task = await aiHub.computeTasks(taskId);
      expect(task.requester).to.equal(requester.address);
      expect(task.gpuProvider).to.equal(gpuProvider.address);
      expect(task.escrowAmount).to.equal(escrowAmount);
      expect(task.isSettled).to.be.false;

      // 2. GPU provider completes the task on external chain & generates proof
      const computeProof = buildMockEventProof(1, "0x" + "f".repeat(64), 19500000, null, null, "2500");
      const gpuBalBefore = await mockToken.balanceOf(gpuProvider.address);

      // 3. Settle verifiable compute task
      await expect(aiHub.settleVerifiableComputeTask(taskId, computeProof))
        .to.emit(aiHub, "ComputeTaskSettled")
        .withArgs(taskId, gpuProvider.address, escrowAmount, computeProof.txHash);

      const gpuBalAfter = await mockToken.balanceOf(gpuProvider.address);
      expect(gpuBalAfter - gpuBalBefore).to.equal(escrowAmount);

      const settledTask = await aiHub.computeTasks(taskId);
      expect(settledTask.isSettled).to.be.true;
    });

    it("should revert if attempting to double-settle the same compute task", async function () {
      await mockToken.connect(requester).approve(await aiHub.getAddress(), escrowAmount);
      await aiHub.connect(requester).depositComputeEscrow(taskId, gpuProvider.address, escrowAmount);

      const computeProof = buildMockEventProof(1, "0x" + "e".repeat(64), 19500001, null, null, "2500");
      await aiHub.settleVerifiableComputeTask(taskId, computeProof);

      const proof2 = buildMockEventProof(1, "0x" + "d".repeat(64), 19500002, null, null, "2500");
      await expect(
        aiHub.settleVerifiableComputeTask(taskId, proof2)
      ).to.be.revertedWithCustomError(aiHub, "TaskAlreadySettled");
    });
  });
});
