const { expect } = require("chai");
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("../scripts/generateProof");

describe("VerifiedEscrow: condition-locked, proof-gated settlement", function () {
  let owner, depositor, seller, stranger;
  let cUSD, mockOracle, escrow;

  const ATT_TOPIC = ethers.id("AttestationVerified(uint256,bytes32)");
  const REPAY_TOPIC = ethers.id("Repay(address,address,address,uint256,bool)");

  before(async function () {
    [owner, depositor, seller, stranger] = await ethers.getSigners();
    cUSD = await (await ethers.getContractFactory("MockERC20")).deploy("Creditcoin USD", "cUSD");
    mockOracle = await (await ethers.getContractFactory("MockAttestationOracle")).deploy();
    escrow = await (await ethers.getContractFactory("VerifiedEscrow")).deploy(
      await cUSD.getAddress(),
      await mockOracle.getAddress()
    );
    await cUSD.mint(depositor.address, ethers.parseEther("100000"));
    await cUSD.connect(depositor).approve(await escrow.getAddress(), ethers.parseEther("100000"));
  });

  function orderRef(n) {
    return ethers.id("PO" + n + "-acme-rwa-invoice");
  }

  async function createEscrow(amount, deadlineDelta = 1000, ref = orderRef("1047")) {
    const height = await ethers.provider.getBlockNumber();
    return escrow.connect(depositor).createEscrow(seller.address, ref, amount, height + deadlineDelta);
  }

  it("locks funds and records the committed release condition", async function () {
    const amount = ethers.parseEther("5000");
    const height = await ethers.provider.getBlockNumber();

    await expect(createEscrow(amount))
      .to.emit(escrow, "EscrowCreated")
      .withArgs(1, depositor.address, seller.address, orderRef("1047"), amount, height + 1000);

    expect(await cUSD.balanceOf(await escrow.getAddress())).to.equal(amount);
    expect(await escrow.totalLockedUSD()).to.equal(amount);

    const rec = await escrow.getEscrow(1);
    expect(rec.depositor).to.equal(depositor.address);
    expect(rec.seller).to.equal(seller.address);
    expect(rec.orderRef).to.equal(orderRef("1047"));
    expect(rec.amountUSD).to.equal(amount);
    expect(rec.released).to.equal(false);
    expect(rec.refunded).to.equal(false);
  });

  it("releases to the committed seller only on a verified cross-chain proof", async function () {
    const amount = ethers.parseEther("5000");
    const beforeSeller = await cUSD.balanceOf(seller.address);
    const proof = await buildMockEventProof(1, "tx-escrow-1-settle");
    const expectedTime = 1_700_000_000 + Number(proof.blockNumber);

    await expect(escrow.connect(stranger).release(1, proof, ATT_TOPIC))
      .to.emit(escrow, "EscrowReleased")
      .withArgs(1, seller.address, amount, 1, proof.txHash, expectedTime);

    expect(await cUSD.balanceOf(seller.address)).to.equal(beforeSeller + amount);
    expect((await escrow.getEscrow(1)).released).to.equal(true);
    expect(await escrow.totalLockedUSD()).to.equal(0n);
  });

  it("prevents proof replay across escrows (one receipt, one release)", async function () {
    await createEscrow(ethers.parseEther("1000"), 1000, orderRef("1048"));
    const proof = await buildMockEventProof(1, "tx-escrow-1-settle");
    await expect(escrow.connect(stranger).release(2, proof, ATT_TOPIC)).to.be.revertedWithCustomError(
      escrow,
      "ProofAlreadyUsed"
    );
    expect((await escrow.getEscrow(2)).released).to.equal(false);
  });

  it("rejects a valid receipt pinned to the wrong event type", async function () {
    await createEscrow(ethers.parseEther("900"), 1000, orderRef("1049"));
    const proof = await buildMockEventProof(1, "tx-escrow-wrong-sig");
    await expect(escrow.connect(stranger).release(3, proof, REPAY_TOPIC)).to.be.revertedWithCustomError(
      escrow,
      "WrongEventSignature"
    );
  });

  it("rejects unverified receipts (fail closed)", async function () {
    await createEscrow(ethers.parseEther("800"), 1000, orderRef("1050"));
    await mockOracle.setAlwaysPass(false);
    const proof = await buildMockEventProof(1, "tx-escrow-unverified");
    await expect(escrow.connect(stranger).release(4, proof, ethers.ZeroHash)).to.be.revertedWithCustomError(
      escrow,
      "ProofRejected"
    );
    await mockOracle.setAlwaysPass(true);
  });

  it("refunds the depositor only after the deadline and blocks release afterwards", async function () {
    await cUSD.mint(depositor.address, ethers.parseEther("5000"));
    await createEscrow(ethers.parseEther("700"), 500, orderRef("1051"));
    const before = await cUSD.balanceOf(depositor.address);

    await expect(escrow.connect(stranger).refundAfterDeadline(5)).to.be.revertedWithCustomError(
      escrow,
      "NotYetRefundable"
    );

    const rec5 = await escrow.getEscrow(5);
    const cur = await ethers.provider.getBlockNumber();
    await ethers.provider.send("hardhat_mine", [ethers.toBeHex(rec5.deadlineBlock - BigInt(cur) + 1n), "0x1"]);

    await expect(escrow.connect(stranger).refundAfterDeadline(5))
      .to.emit(escrow, "EscrowRefunded")
      .withArgs(5, depositor.address, ethers.parseEther("700"));
    expect(await cUSD.balanceOf(depositor.address)).to.equal(before + ethers.parseEther("700"));

    await expect(escrow.connect(stranger).refundAfterDeadline(1)).to.be.revertedWithCustomError(
      escrow,
      "AlreadyReleased"
    );
    const lateProof = await buildMockEventProof(1, "tx-escrow-late");
    await expect(escrow.connect(stranger).release(5, lateProof, ethers.ZeroHash)).to.be.revertedWithCustomError(
      escrow,
      "AlreadyRefunded"
    );
  });

  it("validates creation parameters", async function () {
    const cur = await ethers.provider.getBlockNumber();
    await expect(
      escrow.connect(depositor).createEscrow(ethers.ZeroAddress, orderRef("x"), ethers.parseEther("1"), 1000)
    ).to.be.revertedWithCustomError(escrow, "ZeroAddress");
    await expect(
      escrow.connect(depositor).createEscrow(seller.address, ethers.ZeroHash, ethers.parseEther("1"), 1000)
    ).to.be.revertedWithCustomError(escrow, "InvalidOrderRef");
    await expect(
      escrow.connect(depositor).createEscrow(seller.address, orderRef("x"), 0, 1000)
    ).to.be.revertedWithCustomError(escrow, "ZeroAmount");
    await expect(
      escrow.connect(depositor).createEscrow(seller.address, orderRef("x"), ethers.parseEther("1"), cur)
    ).to.be.revertedWithCustomError(escrow, "DeadlineNotFuture");
  });

  it("only the owner can swap the verifier", async function () {
    await expect(escrow.connect(stranger).setVerifier(seller.address)).to.be.revertedWithCustomError(
      escrow,
      "OnlyOwner"
    );
    await expect(escrow.connect(owner).setVerifier(stranger.address)).to.emit(escrow, "VerifierUpdated").withArgs(
      await mockOracle.getAddress(),
      stranger.address
    );
    await escrow.connect(owner).setVerifier(await mockOracle.getAddress());
  });
});