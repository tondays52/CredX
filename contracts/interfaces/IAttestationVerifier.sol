// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;


/**
 * @title IAttestationVerifier
 * @notice Interface for Creditcoin's Attestcoin Protocol / Universal Smart Contracts (USC) Proof Verifier.
 * @dev Creditcoin provides a native precompile or decentralized oracle verifier to cryptographically
 *      validate Merkle and continuity proofs of source-chain transactions (e.g. Ethereum Mainnet, Sepolia).
 */
interface IAttestationVerifier {

    struct EventProof {
        uint256 sourceChainId;    // e.g. 1 for Ethereum Mainnet, 11155111 for Sepolia
        bytes32 blockHash;        // Source chain block hash containing the transaction
        uint256 blockNumber;      // Source chain block number
        bytes32 txHash;           // Transaction hash on the source chain
        uint256 txIndex;          // Index of the tx in the block
        bytes rlpEncodedReceipt;  // RLP-encoded transaction receipt with logs
        bytes merkleProof;        // Merkle Patricia Trie inclusion proof
    }

    struct AttestationResult {
        bool isValid;             // Whether the proof successfully verified against the source chain consensus
        address emitterAddress;   // The contract address on the source chain that emitted the event
        bytes32 eventSignature;   // Topic0 (event hash)
        bytes eventData;          // Decoded or raw event log data
        uint256 sourceBlockTime;  // Source chain block timestamp
    }

    /**
     * @notice Verifies a cross-chain event proof against the source chain's block headers.
     * @param proof The packaged transaction and Merkle receipt proof.
     * @return result The attestation result containing validation status and verified event parameters.
     */
    function verifyEventProof(EventProof calldata proof) external view returns (AttestationResult memory result);

    /**
     * @notice Fast check if a transaction hash has already been attested by Creditcoin validators.
     * @param sourceChainId The chain ID of the source network.
     * @param txHash The transaction hash to query.
     */
    function isTransactionAttested(uint256 sourceChainId, bytes32 txHash) external view returns (bool);
}
