const { ethers } = require("ethers");

/**
 * Utility to format source chain transaction receipts into CredX / Attestcoin EventProof structs.
 * 
 * @param {number|string} sourceChainId - Source network chain ID (e.g. 1 = Mainnet, 11155111 = Sepolia)
 * @param {string} [txHash] - Transaction hash on the source chain (32-byte hex)
 * @param {number} [blockNumber] - Source chain block number
 * @param {string} [blockHash] - Source chain block hash
 * @param {string} [emitterAddress] - Contract address that emitted the event
 * @param {number|string} [valueUSD] - Verified value in USD
 * @returns {object} Attestcoin EventProof struct formatted for IAttestationVerifier
 */
function buildMockEventProof(sourceChainId, txHash, blockNumber, blockHash, emitterAddress, valueUSD) {
  const resolvedChainId = Number(sourceChainId) || 11155111;

  // Ensure resolvedTxHash is strictly a valid 32-byte hex string (bytes32)
  let resolvedTxHash;
  if (txHash && ethers.isHexString(txHash, 32)) {
    resolvedTxHash = txHash;
  } else if (txHash && typeof txHash === "string") {
    resolvedTxHash = ethers.isHexString(txHash)
      ? ethers.zeroPadValue(txHash, 32)
      : ethers.keccak256(ethers.toUtf8Bytes(txHash));
  } else {
    resolvedTxHash = ethers.hexlify(ethers.randomBytes(32));
  }

  const resolvedBlockNumber = Number(blockNumber) || 19283746;

  // Ensure resolvedBlockHash is strictly a valid 32-byte hex string (bytes32)
  let resolvedBlockHash;
  if (blockHash && ethers.isHexString(blockHash, 32)) {
    resolvedBlockHash = blockHash;
  } else if (blockHash && typeof blockHash === "string") {
    resolvedBlockHash = ethers.isHexString(blockHash)
      ? ethers.zeroPadValue(blockHash, 32)
      : ethers.keccak256(ethers.toUtf8Bytes(blockHash));
  } else {
    resolvedBlockHash = ethers.keccak256(ethers.toUtf8Bytes("block-" + resolvedBlockNumber));
  }

  const resolvedValue = valueUSD ? valueUSD.toString() : "50000";

  // Deterministic RLP receipt data incorporating resolved parameters
  const dummyRlpReceipt = ethers.hexlify(
    ethers.toUtf8Bytes(`USC_PROOF_DATA_TX_${resolvedTxHash}_VAL_${resolvedValue}`)
  );
  // Merkle Patricia Trie proof simulation
  const dummyMerkleProof = ethers.hexlify(ethers.randomBytes(64));

  return {
    sourceChainId: resolvedChainId,
    blockHash: resolvedBlockHash,
    blockNumber: resolvedBlockNumber,
    txHash: resolvedTxHash,
    txIndex: 3,
    rlpEncodedReceipt: dummyRlpReceipt,
    merkleProof: dummyMerkleProof,
  };
}

/**
 * Utility to generate an array of mock proofs for batch submission.
 * @param {Array<object>} items - List of items with { chainId, txHash, blockNumber, valueUSD }
 * @returns {Array<object>} Array of EventProof structs
 */
function buildBatchProofs(items) {
  return items.map(item => buildMockEventProof(
    item.chainId,
    item.txHash,
    item.blockNumber,
    item.blockHash,
    item.emitterAddress,
    item.valueUSD
  ));
}

// Standalone execution support: node scripts/generateProof.js
if (require.main === module) {
  console.log("==================================================");
  console.log("   🛡️ CredX Attestcoin EventProof Generator");
  console.log("==================================================");
  const sample = buildMockEventProof(
    11155111,
    "0xa515e6844f02f0fb90114b7cc1abb0a39b4bed6be8acf114674be8ac19cd6200",
    5928192,
    null,
    null,
    "50000"
  );
  console.log("Generated Sample EventProof Struct:");
  console.log(JSON.stringify(sample, null, 2));
}

module.exports = {
  buildMockEventProof,
  buildBatchProofs,
};
