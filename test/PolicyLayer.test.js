const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("../scripts/generateProof");

describe("Enterprise Policy Layer: Purpose-Bound Funding & Usage Metering", function () {
  let owner, user1, lowScoreUser, recipient, kycAgent;
  let credXHub, scoreEngine, mockOracle, cUSD;
  let purposeFund, meterRegistry;

  const APPROVED = ethers.parseEther("10000"); // $10,000
  const LIQUIDITY = ethers.parseEther("1000000");

  before(async function () {
    [owner, user1, lowScoreUser, recipient, kycAgent] = await ethers.getSigners();

    cUSD = await (await ethers.getContractFactory("MockERC20")).deploy("Creditcoin USD", "cUSD");

    scoreEngine = await (await ethers.getContractFactory("CreditScoreEngine")).deploy();
    const MockOracle = await ethers.getContractFactory("MockAttestationOracle");
    mockOracle = await MockOracle.deploy();

    const CredXHub = await ethers.getContractFactory("CredXHub");
    credXHub = await CredXHub.deploy(await mockOracle.getAddress(), await scoreEngine.getAddress());
    await scoreEngine.setCredXHub(await credXHub.getAddress());

    const PurposeBoundFunding = await ethers.getContractFactory("PurposeBoundFunding");
    purposeFund = await PurposeBoundFunding.deploy(
      await cUSD.getAddress(),
      await credXHub.getAddress(),
      await scoreEngine.getAddress(),
      await mockOracle.getAddress()
    );

    const UsageMeteringRegistry = await ethers.getContractFactory("UsageMeteringRegistry");
    meterRegistry = await UsageMeteringRegistry.deploy(
      await cUSD.getAddress(),
      await mockOracle.getAddress(),
      await credXHub.getAddress()
    );

    // Give user1 a Super-Prime profile (>= 780 CTS) exactly as the DeFi suite does.
    for (let i = 0; i < 15; i++) {
      const proof = await buildMockEventProof(1, "tx-pol-" + user1.address + i);
      await credXHub.connect(user1).submitRepaymentProof(proof, 0, ethers.parseEther("60000"));
    }

    // Seed liquidity + user balances
    await cUSD.mint(owner.address, LIQUIDITY);
    await cUSD.connect(owner).approve(await purposeFund.getAddress(), LIQUIDITY);
    await purposeFund.connect(owner).depositLiquidity(LIQUIDITY);

    await cUSD.mint(user1.address, ethers.parseEther("20000"));
    await cUSD.mint(kycAgent.address, ethers.parseEther("50000"));
    await cUSD.connect(user1).approve(await purposeFund.getAddress(), ethers.parseEther("20000"));
  });

  describe("PurposeBoundFunding (idea 3: purpose-bound RWA funding)", function () {
    let recordId;

    it("funds a purpose-bound record and locks collateral", async function () {
      const covenantHash = ethers.id("INVOICE-PO#1047 buyer=acme corp purpose=RWA invoice settlement");
      const heightBefore = await ethers.provider.getBlockNumber();
      const tx = await purposeFund
        .connect(user1)
        .fundPurpose(0, recipient.address, covenantHash, APPROVED, { value: ethers.parseEther("4000") });

      await expect(tx).to.emit(purposeFund, "PurposeFunded").withArgs(
        1,
        user1.address,
        0,
        recipient.address,
        covenantHash,
        APPROVED,
        ethers.parseEther("3500"),
        heightBefore + 216001
      );

      const rec = await purposeFund.getRecord(1);
      expect(rec.borrower).to.equal(user1.address);
      expect(rec.allowlistedRecipient).to.equal(recipient.address);
      expect(rec.approvedUSD).to.equal(APPROVED);
      expect(rec.drawnUSD).to.equal(0n);
      expect(rec.isFrozen).to.equal(false);
      expect(rec.isSettled).to.equal(false);
      recordId = 1;
    });

    it("disburses purpose-bound funds ONLY to the allowlisted recipient", async function () {
      const beforeRecipient = await cUSD.balanceOf(recipient.address);
      const beforeBorrower = await cUSD.balanceOf(user1.address);

      await purposeFund.connect(user1).disburseToRecipient(recordId, ethers.parseEther("1000"));

      expect(await cUSD.balanceOf(recipient.address)).to.equal(beforeRecipient + ethers.parseEther("1000"));
      expect(await cUSD.balanceOf(user1.address)).to.equal(beforeBorrower); // borrower routed nothing to itself
      expect((await purposeFund.getRecord(recordId)).drawnUSD).to.equal(ethers.parseEther("1000"));
    });

    it("rejects draws beyond the approved amount", async function () {
      await expect(
        purposeFund.connect(user1).disburseToRecipient(recordId, ethers.parseEther("9999"))
      ).to.be.revertedWithCustomError(purposeFund, "DrawExceedsApproval");
    });

    it("rejects non-borrowers from disbursing", async function () {
      await expect(
        purposeFund.connect(lowScoreUser).disburseToRecipient(recordId, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(purposeFund, "OnlyBorrower");
    });

    it("disburses a borrower tranche only after an attested usage receipt", async function () {
      const proof = await buildMockEventProof(1, "tx-usage-attested-" + recipient.address);
      const beforeBorrower = await cUSD.balanceOf(user1.address);

      await purposeFund.connect(user1).disburseAttestedTranche(
        recordId,
        ethers.parseEther("500"),
        proof,
        ethers.id("AttestationVerified(uint256,bytes32)")
      );

      expect(await cUSD.balanceOf(user1.address)).to.equal(beforeBorrower + ethers.parseEther("500"));
      await expect(purposeFund.connect(user1).disburseAttestedTranche(
        recordId,
        ethers.parseEther("100"),
        proof,
        ethers.id("Repay(address,address,address,uint256,bool)")
      )).to.be.revertedWithCustomError(purposeFund, "WrongEventSignature");
    });

    it("rejects an unverified usage proof", async function () {
      await mockOracle.setAlwaysPass(false);
      const proof = await buildMockEventProof(1, "tx-never-attested-" + user1.address);
      await expect(
        purposeFund.connect(user1).disburseAttestedTranche(recordId, ethers.parseEther("100"), proof, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(purposeFund, "ProofRejected");
      await mockOracle.setAlwaysPass(true);
    });

    it("freezes the record on covenant breach (deadswitch) and blocks further disbursement", async function () {
      await purposeFund.freezeForBreach(recordId, ethers.id("evid-1"), "attested collateral departure");

      await expect(
        purposeFund.connect(user1).disburseToRecipient(recordId, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(purposeFund, "RecordFrozen");

      await purposeFund.restoreRecord(recordId);
      await purposeFund.connect(user1).disburseToRecipient(recordId, ethers.parseEther("1"));
      expect((await purposeFund.getRecord(recordId)).isFrozen).to.equal(false);
    });

    it("settles the record, repaying principal + interest and refunding collateral", async function () {
      await purposeFund.connect(user1).settleRecord(recordId, APPROVED + ethers.parseEther("1"));

      const rec = await purposeFund.getRecord(recordId);
      expect(rec.isSettled).to.equal(true);
      expect(rec.collateralCTC).to.equal(0n);

      await expect(
        purposeFund.connect(user1).disburseToRecipient(recordId, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(purposeFund, "AlreadySettled");
    });
  });

  describe("UsageMeteringRegistry (idea 4: metered accountable usage)", function () {
    const GPU_KEY = ethers.id("gpu.lease.seconds");

    before(async function () {
      const ownerRegister = await meterRegistry.connect(owner).setMeter(user1.address, GPU_KEY, ethers.parseEther("1000"), 100, ethers.parseEther("2"));
      await ownerRegister;
    });

    it("registers a meter and rejects non-owner configuration", async function () {
      await expect(
        meterRegistry.connect(lowScoreUser).setMeter(user1.address, GPU_KEY, 100, 100, 1)
      ).to.be.revertedWithCustomError(meterRegistry, "OnlyOwner");

      const reading = await meterRegistry.getMeterReading(user1.address, GPU_KEY);
      expect(reading.exists).to.equal(true);
      expect(reading.windowCapUnits).to.equal(ethers.parseEther("1000"));
      expect(reading.unitPriceUSD).to.equal(ethers.parseEther("2"));
    });

    it("accrues debt via attested usage and enforces the window cap (fail closed)", async function () {
      const proof = await buildMockEventProof(1, "tx-meter-1-" + user1.address);

      await expect(meterRegistry.recordAttestedUsage(
        user1.address,
        GPU_KEY,
        ethers.parseEther("400"),
        proof,
        ethers.id("AttestationVerified(uint256,bytes32)")
      )).to.emit(meterRegistry, "UsageRecorded");

      // 400 + 400 = 800 <= 1000 OK
      const proof2 = await buildMockEventProof(1, "tx-meter-2-" + user1.address);
      await meterRegistry.recordAttestedUsage(user1.address, GPU_KEY, ethers.parseEther("400"), proof2, ethers.id("AttestationVerified(uint256,bytes32)"));

      // 800 + 400 = 1200 > 1000 -> revert
      const proof3 = await buildMockEventProof(1, "tx-meter-3-" + user1.address);
      await expect(
        meterRegistry.recordAttestedUsage(user1.address, GPU_KEY, ethers.parseEther("400"), proof3, ethers.id("AttestationVerified(uint256,bytes32)"))
      ).to.be.revertedWithCustomError(meterRegistry, "ExceedsWindowCap");

      // Debt = 800 units * $2 = $1,600
      expect(await meterRegistry.getTotalOutstandingDebt(user1.address)).to.equal(ethers.parseEther("1600"));
    });

    it("rejects unverified or wrong-signature attested usage", async function () {
      await mockOracle.setAlwaysPass(false);
      const proof = await buildMockEventProof(1, "tx-never-metered-" + user1.address);
      await expect(
        meterRegistry.recordAttestedUsage(user1.address, GPU_KEY, ethers.parseEther("1"), proof, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(meterRegistry, "ProofRejected");
      await mockOracle.setAlwaysPass(true);

      const proofOk = await buildMockEventProof(1, "tx-meter-sig-" + user1.address);
      await expect(
        meterRegistry.recordAttestedUsage(user1.address, GPU_KEY, ethers.parseEther("1"), proofOk, ethers.id("Repay(address,address,address,uint256,bool)"))
      ).to.be.revertedWithCustomError(meterRegistry, "WrongEventSignature");
    });

    it("rolls the window over after its duration and resets usage", async function () {
      const before = await meterRegistry.getMeterReading(user1.address, GPU_KEY);
      expect(before.usedUnitsThisWindow).to.be.gt(0n);

      const target = before.windowStartBlock + before.windowDurationBlocks;
      await ethers.provider.send("hardhat_mine", [ethers.toBeHex(target - BigInt(await ethers.provider.getBlockNumber())), "0x1"]);

      // First increment in the new window must reset usedUnitsThisWindow.
      const proof = await buildMockEventProof(1, "tx-meter-roll-" + user1.address);
      await meterRegistry.recordAttestedUsage(user1.address, GPU_KEY, ethers.parseEther("300"), proof, ethers.id("AttestationVerified(uint256,bytes32)"));

      const after = await meterRegistry.getMeterReading(user1.address, GPU_KEY);
      expect(after.usedUnitsThisWindow).to.equal(ethers.parseEther("300"));
    });

    it("lets only KYC agents report telemetry usage", async function () {
      await meterRegistry.setKycAgent(kycAgent.address, true);

      await expect(
        meterRegistry.connect(lowScoreUser).reportTelemetryUsage(user1.address, GPU_KEY, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(meterRegistry, "OnlyKycAgent");

      await expect(meterRegistry.connect(kycAgent).reportTelemetryUsage(user1.address, GPU_KEY, ethers.parseEther("10")))
        .to.emit(meterRegistry, "UsageRecorded");
    });

    it("settles outstanding debt in the settlement token", async function () {
      await cUSD.mint(kycAgent.address, ethers.parseEther("50000"));
      await cUSD.connect(kycAgent).approve(await meterRegistry.getAddress(), ethers.parseEther("50000"));

      const owedBefore = await meterRegistry.getTotalOutstandingDebt(user1.address);
      expect(owedBefore).to.be.gt(0n);

      const paid = await meterRegistry.connect(kycAgent).settleDebt.staticCall(user1.address, GPU_KEY, owedBefore);
      expect(paid).to.equal(owedBefore);

      await meterRegistry.connect(kycAgent).settleDebt(user1.address, GPU_KEY, owedBefore);

      expect(await meterRegistry.getTotalOutstandingDebt(user1.address)).to.equal(0n);
      const reading = await meterRegistry.getMeterReading(user1.address, GPU_KEY);
      expect(reading.outstandingDebtUSD).to.equal(0n);
    });
  });
});