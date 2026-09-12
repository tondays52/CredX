require("dotenv").config();
const { ethers } = require("hardhat");
const { buildMockEventProof } = require("./generateProof");

async function main() {
  const data = JSON.parse(require("fs").readFileSync("deployments.json", "utf8"));
  const c = data.contracts;
  const verifier = await ethers.getContractAt("MockAttestationOracle", c.AttestationVerifier);
  console.log("alwaysPass:", await verifier.alwaysPass());

  const proof = await buildMockEventProof(
    11155111,
    "0x" + "ab" + "00".repeat(14) + "cc3escrow0001",
    5928192,
    null,
    null,
    "1500"
  );
  const res = await verifier.verifyEventProof.staticCall(proof);
  console.log("isValid:", res.isValid);
  console.log("eventSignature:", res.eventSignature);
  console.log("expected ATT topic:", ethers.id("AttestationVerified(uint256,bytes32)"));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});