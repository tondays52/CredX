const { ethers } = require("ethers");

/**
 * Utility to format source chain transaction receipts into CredX / Attestcoin EventProof structs.
 */
function buildMockEventProof(sourceChainId, txHash, blockNumber, blockHash, emitterAddress, valueUSD) {
  const dummyRlpReceipt = ethers.hexlify(ethers.toUtf8Bytes(`USC_PROOF_DATA_TX_${txHash}_VAL_${valueUSD}`));
  const dummyMerkleProof = ethers.hexlify(ethers.randomBytes(64));

  return {
    sourceChainId: sourceChainId,
    blockHash: blockHash || ethers.keccak256(ethers.toUtf8Bytes("block-" + blockNumber)),
    blockNumber: blockNumber || 19283746,
    txHash: txHash || ethers.hexlify(ethers.randomBytes(32)),
    txIndex: 3,
    rlpEncodedReceipt: dummyRlpReceipt,
    merkleProof: dummyMerkleProof,
  };
}

module.exports = {
  buildMockEventProof,
};
