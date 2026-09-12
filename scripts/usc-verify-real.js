/**
 * scripts/usc-verify-real.js
 *
 * LIVE Attestcoin Protocol (USC) integration test:
 *  - reads the supported source chains from Creditcoin's ChainInfo precompile (0x0FD3)
 *  - picks a real, already-attested source-chain block (default: Ethereum Sepolia)
 *  - fetches a Merkle + continuity proof from Creditcoin's public proof-builder service
 *  - verifies it against the BlockProver precompile (0x0FD2) via @gluwa/usc-sdk
 *  - (optional) submits verifyAndEmit (emits TransactionVerified) using PRIVATE_KEY
 *  - (optional) anchors the verified tx on-chain through the deployed
 *    BlockProverAttestationOracle contract
 *
 * Usage:
 *   node scripts/usc-verify-real.js
 *   CREDITCOIN_RPC_URL=... SOURCE_CHAIN_ID=1 node scripts/usc-verify-real.js
 *   SOURCE_TX_HASH=0x... SOURCE_BLOCK_HEIGHT=... node scripts/usc-verify-real.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { JsonRpcProvider, Wallet } = require("ethers");
const { chainInfo, blockProver, proofProvider } = require("@gluwa/usc-sdk");

const title = "=".repeat(70);
const hr = "-".repeat(70);

function envOr(name, fallback) {
  return process.env[name] || fallback;
}

function chooseSourceRpc(chainId) {
  if (chainId === 1) return envOr("MAINNET_RPC_URL", "https://ethereum-rpc.publicnode.com");
  if (chainId === 11155111) return envOr("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com");
  return envOr("SOURCE_RPC_URL", null);
}

async function pickTx(sourceProvider, txHashEnv, heightEnv) {
  if (txHashEnv) {
    const receipt = await sourceProvider.getTransactionReceipt(txHashEnv);
    if (!receipt) throw new Error(`No receipt found for source tx ${txHashEnv}`);
    return { txHash: txHashEnv, height: heightEnv ? Number(heightEnv) : receipt.blockNumber };
  }
  if (heightEnv) {
    const block = await sourceProvider.getBlock(Number(heightEnv));
    if (!block || !block.transactions || block.transactions.length === 0) {
      throw new Error(`Source block ${heightEnv} has no transactions`);
    }
    const txHash = block.transactions[block.transactions.length - 1];
    return { txHash, height: Number(heightEnv) };
  }
  return null;
}

async function main() {
  console.log(title);
  console.log("  USC BlockProver — LIVE Attestcoin Protocol verification on Creditcoin");
  console.log(title);

  const creditcoinRpc = envOr("CREDITCOIN_RPC_URL", "https://rpc.cc3-testnet.creditcoin.network");
  const proofBuilderUrl = envOr("CREDITCOIN_PROOF_BUILDER_URL", "https://prover.cc3-testnet.creditcoin.network");

  const creditcoinProvider = new JsonRpcProvider(creditcoinRpc);
  const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);
  const prover = new blockProver.PrecompileBlockProver(creditcoinProvider);

  // 1. Real read: which chains do Creditcoin validators support?
  console.log("\n[1/6] Supported source chains (ChainInfo precompile 0x0FD3):");
  const supported = await chainInfoProvider.getSupportedChains();
  const evm = supported.filter((c) => c.chainEncoding === 1);
  for (const c of supported) {
    console.log(
      `  - chainKey=${c.chainKey} chainId=${c.chainId} name=${c.chainName || "(unnamed)"} encoding=${c.chainEncoding}`
    );
  }
  if (evm.length === 0) throw new Error("No EVM source chains supported by this Creditcoin node.");

  // 2. Choose the source chain.
  let target = null;
  const preferredChainId = Number(envOr("SOURCE_CHAIN_ID", "11155111"));
  target = evm.find((c) => c.chainId === preferredChainId);
  if (!target) {
    target = evm.find((c) => c.chainId === 1) || evm[0];
    console.log(`  (chainId ${preferredChainId} not supported; using chainId ${target.chainId})`);
  }
  const chainKey = target.chainKey;

  const sourceRpc = chooseSourceRpc(target.chainId);
  if (!sourceRpc) throw new Error(`No SOURCE_RPC_URL configured for chainId ${target.chainId}`);
  const sourceProvider = new JsonRpcProvider(sourceRpc);

  console.log(`\n[2/6] Target source chain: chainKey=${chainKey} (chainId=${target.chainId})`);

  // 3. Pick a real, attested transaction (either user-provided or from the latest attested height).
  console.log("[3/6] Resolving an attested source transaction...");
  let tx = await pickTx(sourceProvider, envOr("SOURCE_TX_HASH", null), envOr("SOURCE_BLOCK_HEIGHT", null));
  if (!tx) {
    const latest = await chainInfoProvider.getLatestAttestedHeightAndHash(chainKey);
    if (!latest.exists) throw new Error(`No attestations yet for chainKey ${chainKey}`);
    console.log(`  latest attested height: ${latest.height} (isAttestation=${latest.isAttestation})`);
    const block = await sourceProvider.getBlock(latest.height);
    if (!block || !block.transactions || block.transactions.length === 0) {
      throw new Error(`Attested height ${latest.height} has no fetchable transactions`);
    }
    tx = { txHash: block.transactions[block.transactions.length - 1], height: Number(latest.height) };
  }
  console.log(`  source tx: ${tx.txHash}`);
  console.log(`  source block height: ${tx.height}`);

  // 4. Wait for attestation (no-op when already attested).
  console.log("[4/6] Waiting for height attestation (if needed)...");
  await chainInfoProvider.waitUntilHeightAttested(chainKey, tx.height, 8000, 600000);
  console.log(`  ✓ height ${tx.height} is attested`);

  // 5. Fetch the Merkle + continuity proof from Creditcoin's proof-builder service.
  console.log("[5/6] Requesting proof from proof-builder service...");
  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, proofBuilderUrl);
  let proofResult = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    proofResult = await proofBuilder.getProof(tx.txHash);
    if (proofResult.success && proofResult.data) break;
    console.log(`  proof attempt ${attempt} failed (${proofResult.error}); retrying...`);
    await new Promise((r) => setTimeout(r, 15000));
  }
  if (!proofResult || !proofResult.success || !proofResult.data) {
    throw new Error(`Proof generation ultimately failed: ${proofResult && proofResult.error}`);
  }
  const data = proofResult.data;
  console.log(`  ✓ proof for tx ${data.txHash}`);
  console.log(`    headerNumber=${data.headerNumber}  txIndex=${data.txIndex}`);
  console.log(`    continuityRoots=${data.continuityProof.roots.length}  merkleSiblings=${data.merkleProof.siblings.length}`);

  // 6. Crypto-verify against the BlockProver precompile (0x0FD2).
  console.log("[6/6] Verifying proof against BlockProver precompile 0x0FD2...");
  const verified = await prover.verifySingle(
    data.chainKey,
    data.headerNumber,
    data.txBytes,
    data.merkleProof,
    data.continuityProof
  );
  console.log(`\n  RESULT: proof verification = ${verified ? "SUCCESS ✔" : "FAILED ✘"}`);
  if (!verified) throw new Error("0x0FD2 could not verify the proof against Creditcoin attestations.");

  // 7. Optional: emit the canonical TransactionVerified event via verifyAndEmit.
  const privateKey = envOr("PRIVATE_KEY", "");
  if (privateKey) {
    const wallet = new Wallet(privateKey, creditcoinProvider);
    const txIndex = await prover.computeTransactionIndex(data.merkleProof);
    console.log(`\n[+] Submitting verifyAndEmit (TransactionVerified event, txIndex=${txIndex})...`);
    const emitTx = await prover.verifyAndEmitSingle(
      wallet,
      data.chainKey,
      data.headerNumber,
      data.txBytes,
      data.merkleProof,
      data.continuityProof
    );
    const receipt = await emitTx.wait();
    console.log(`  ✓ verifyAndEmit tx: ${receipt.hash}`);
    console.log(`    https://creditcoin-testnet.blockscout.com/tx/${receipt.hash}`);
    console.log(`    TransactionVerified event logs: ${receipt.logs.length}`);

    // 8. Optional: anchor through the deployed BlockProverAttestationOracle.
    const deploymentFile = path.join(__dirname, "../deployments.json");
    if (fs.existsSync(deploymentFile)) {
      const deploys = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
      const oracleAddr = deploys.contracts && deploys.contracts.BlockProverAttestationOracle;
      if (oracleAddr) {
        console.log(`\n[+] Anchoring via BlockProverAttestationOracle at ${oracleAddr}...`);
        const abiPath = path.join(
          __dirname,
          "../artifacts/contracts/core/tracks/BlockProverAttestationOracle.sol/BlockProverAttestationOracle.json"
        );
        const { abi } = JSON.parse(fs.readFileSync(abiPath, "utf8"));
        const oracle = new (require("ethers").Contract)(oracleAddr, abi, wallet);
        const anchorTx = await oracle.anchorVerifiedTransaction(
          data.chainKey,
          data.headerNumber,
          data.txBytes,
          data.merkleProof,
          data.continuityProof
        );
        const anchorReceipt = await anchorTx.wait();
        console.log(`  ✓ anchored, tx: ${anchorReceipt.hash}`);
        console.log(`    https://creditcoin-testnet.blockscout.com/tx/${anchorReceipt.hash}`);
        console.log(`    anchoredCount=${await oracle.anchoredCount()}`);
      } else {
        console.log("\n  (skip) BlockProverAttestationOracle not in deployments.json — skipping anchor step.");
      }
    }
  }

  console.log("\n" + hr);
  console.log("  USC LIVE verification complete. 0x0FD2 accepted a real source-chain proof.");
  console.log(hr);
}

main().catch((error) => {
  console.error("\n❌ USC verification failed:");
  console.error("  ", error && error.message ? error.message : error);
  process.exitCode = 1;
});