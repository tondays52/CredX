// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


/**
 * @title ICreditcoinBlockProver
 * @notice Exact ABI of Creditcoin's Attestcoin Protocol BlockProver precompile (0x0FD2).
 * @dev Mirrors the JSON ABI shipped in @gluwa/usc-sdk (dist/block-prover/block_prover.json).
 *      The precompile verifies a source-chain transaction against Creditcoin validator
 *      attestations (Merkle proof + continuity proof over rollup roots) and, on success,
 *      emits the TransactionVerified event.
 */
interface ICreditcoinBlockProver {

    /// @dev One sibling of the transaction Merkle proof.
    struct MerkleProofEntry {
        bytes32 hash;
        bool isLeft;
    }

    /// @dev Merkle proof that the transaction header is included in the rollup root.
    struct MerkleProof {
        bytes32 root;
        MerkleProofEntry[] siblings;
    }

    /// @dev Continuity proof linking rollup roots to a Creditcoin attestation endpoint.
    struct ContinuityProof {
        bytes32 lowerEndpointDigest;
        bytes32[] roots;
    }

    /**
     * @notice Statically verifies a source-chain transaction against an attested height.
     * @param chainKey The Creditcoin internal chain key of the source chain.
     * @param height The attested source-chain block height.
     * @param encodedTransaction The encoded source-chain transaction.
     * @param merkleProof Merkle inclusion proof (rollup root -> transaction).
     * @param continuityProof Continuity proof (rollup roots -> attested endpoint digest).
     * @return true when the transaction is cryptographically verified against Creditcoin attestations.
     */
    function verify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external view returns (bool);

    /**
     * @notice Same as verify but pays the precompile's emitter fee and records the
     *         TransactionVerified event in the Creditcoin state.
     * @return true when verification succeeded.
     */
    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool);

    /// @notice Emitted by the precompile whenever verifyAndEmit succeeds.
    event TransactionVerified(
        uint64 indexed chainKey,
        uint64 indexed height,
        uint64 transactionIndex
    );
}