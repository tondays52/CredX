require("dotenv").config();
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("./generateProof");

async function main() {
  const data = JSON.parse(require("fs").readFileSync("deployments.json", "utf8"));
  const c = data.contracts;
  const [deployer] = await ethers.getSigners();
  const demo = deployer.address;

  const cUSD = await ethers.getContractAt("MockERC20", c.cUSD);
  const escrow = await ethers.getContractAt("VerifiedEscrow", c.VerifiedEscrow);
  const meter = await ethers.getContractAt("UsageMeteringRegistry", c.UsageMeteringRegistry);

  const verifier = await ethers.getContractAt("MockAttestationOracle", c.AttestationVerifier);

  console.log("cUSD balance(demo):", ethers.formatEther(await cUSD.balanceOf(demo)));

  const seedEscrow = !process.env.SKIP_ESCROW;
  const seedMeter = !process.env.SKIP_METER;

  if (seedEscrow) {
    const bal = await cUSD.balanceOf(demo);
    if (bal < ethers.parseEther("2000")) {
      const tx = await cUSD.mint(demo, ethers.parseEther("20000"));
      await tx.wait();
      console.log("minted cUSD 20,000 to demo");
    }
    const allowance = await cUSD.allowance(demo, await escrow.getAddress());
    if (allowance < ethers.parseEther("1500")) {
      await (await cUSD.approve(await escrow.getAddress(), ethers.parseEther("100000"))).wait();
    }
    const seller = ethers.getAddress("0x" + "e04bb93a6a4cb1a4c2b45a0d5e4e38d091fc2b5c");
    const orderRef = ethers.id("PO-CC3-2026-001 buyer=acme corp purpose=RWA invoice settlement");
    const height = await ethers.provider.getBlockNumber();
    const tx = await escrow.createEscrow(seller, orderRef, ethers.parseEther("1500"), height + 216000);
    const rcpt = await tx.wait();
    console.log("escrow created at block", rcpt.blockNumber);
    console.log("escrowCount:", (await escrow.escrowCount()).toString());

    const proof = await buildMockEventProof(
      11155111,
      "0x" + "ab" + "00".repeat(14) + "cc3escrow0001",
      5928192,
      null,
      null,
      "1500"
    );
    const result = await verifier.verifyEventProof.staticCall(proof);
    const rtx = await escrow.release(1, proof, result.eventSignature);
    const rrcpt = await rtx.wait();
    console.log("escrow #1 released at block", rrcpt.blockNumber, "→ seller received $1,500");
  }

  if (seedMeter) {
    const GPU_KEY = ethers.id("gpu.lease.seconds");
    const exists = (await meter.meters(demo, GPU_KEY)).exists;
    if (!exists) {
      await (await meter.setMeter(demo, GPU_KEY, ethers.parseEther("1000"), 100, ethers.parseEther("2"))).wait();
      console.log("meter configured for demo (cap 1,000 · $2/unit)");
    }
    const bal = await meter.getPrepaidBalance(demo);
    if (bal < ethers.parseEther("1000")) {
      const cbal = await cUSD.balanceOf(demo);
      if (cbal < ethers.parseEther("1000")) {
        await (await cUSD.mint(demo, ethers.parseEther("10000"))).wait();
      }
      await (await cUSD.approve(await meter.getAddress(), ethers.parseEther("100000"))).wait();
      await (await meter.topUp(ethers.parseEther("1000"))).wait();
      console.log("prepaid top-up $1,000 → demo");
    }
    const proof = await buildMockEventProof(
      11155111,
      "0x" + "cd" + "00".repeat(14) + "cc3meter0001",
      5940011,
      null,
      null,
      "600"
    );
    const result = await verifier.verifyEventProof.staticCall(proof);
    await (await meter.recordAttestedUsage(demo, GPU_KEY, ethers.parseEther("300"), proof, result.eventSignature)).wait();
    console.log("attested usage: 300 GPU sec consumed → prepaid -$600");
    console.log("prepaidBalance:", ethers.formatEther(await meter.getPrepaidBalance(demo)));
    console.log("prepaidSpent:", ethers.formatEther(await meter.getTotalPrepaidSpent(demo)));
    console.log("debt:", ethers.formatEther(await meter.getTotalOutstandingDebt(demo)));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});