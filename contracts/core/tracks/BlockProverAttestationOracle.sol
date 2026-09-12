// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ICreditcoinBlockProver } from "../../interfaces/ICreditcoinBlockProver.sol";
import { ICreditcoinChainInfo } from "../../interfaces/ICreditcoinChainInfo.sol";
import { AttestcoinConstants } from "../../libraries/AttestcoinConstants.sol";

/**
 * @title BlockProverAttestationOracle
 * @notice Real, on-chain integration with Creditcoin's Attestcoin Protocol (USC) BlockProver precompile 0x0FD2.
 * @dev Wraps the Attestcoin Protocol BlockProver + ChainInfo precompiles so that any downstream
 *      Creditcoin contract can cryptographically verify source-chain transactions (e.g. Ethereum
 *      Mainnet / Sepolia) against Creditcoin validator attestations, and anchor verified proofs
 *      on-chain with replay protection.
 *
 *      The precompile address is a constructor parameter (defaulting to the canonical 0x0FD2) so
 *      the local Hardhat suite can point at a mock precompile; on Creditcoin L1 the real precompile
 *      is used.
 */
contract BlockProverAttestationOracle {
    address public immutable owner;
    address public immutable blockProverPrecompile;
    address public immutable chainInfoPrecompile;

    /// @dev chainKey -> height -> keccak(encodedTransaction) -> credited when anchored.
    mapping(uint64 => mapping(uint64 => mapping(bytes32 => bool))) public anchoredTransactions;
    uint256 public anchoredCount;

    /// @notice Fired whenever a proof is verified by the real precompile and anchored.
    event ProofAnchored(uint64 indexed chainKey, uint64 indexed height, bytes32 indexed txHash, bool verified);

    constructor(address blockProver_, address chainInfo_) {
        owner = msg.sender;
        blockProverPrecompile = blockProver_ == address(0)
            ? AttestcoinConstants.PRECOMPILE_ADDRESS
            : blockProver_;
        chainInfoPrecompile = chainInfo_ == address(0) ? address(0x0fd3) : chainInfo_;
    }

    /* ============ BlockProver (0x0FD2) — real verification ============ */

    /// @notice Static (no gas, no state) verification against Creditcoin attestations via the precompile.
    function verifySourceTransaction(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        ICreditcoinBlockProver.MerkleProof calldata merkleProof,
        ICreditcoinBlockProver.ContinuityProof calldata continuityProof
    ) public view returns (bool verified) {
        (bool ok, bytes memory ret) = blockProverPrecompile.staticcall(
            abi.encodeCall(
                ICreditcoinBlockProver.verify,
                (chainKey, height, encodedTransaction, merkleProof, continuityProof)
            )
        );
        if (!ok || ret.length < 32) return false;
        return abi.decode(ret, (bool));
    }

    /// @notice Anchors a verified source transaction on-chain. Proofs that fail do not revert
    ///         the whole call; they simply return false.
    function anchorVerifiedTransaction(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        ICreditcoinBlockProver.MerkleProof calldata merkleProof,
        ICreditcoinBlockProver.ContinuityProof calldata continuityProof
    ) external returns (bool verified) {
        bytes32 txKey = keccak256(encodedTransaction);
        require(!anchoredTransactions[chainKey][height][txKey], "BlockProverAttestationOracle: already anchored");

        (bool ok, bytes memory ret) = blockProverPrecompile.call{
            gas: 500000
        }(
            abi.encodeCall(
                ICreditcoinBlockProver.verifyAndEmit,
                (chainKey, height, encodedTransaction, merkleProof, continuityProof)
            )
        );
        verified = ok && ret.length >= 32 && abi.decode(ret, (bool));
        if (!verified) return false;

        anchoredTransactions[chainKey][height][txKey] = true;
        anchoredCount += 1;
        emit ProofAnchored(chainKey, height, txKey, true);
        return true;
    }

    /// @notice True when this anchor already credits the given source transaction.
    function isTxAnchored(uint64 chainKey, uint64 height, bytes calldata encodedTransaction) external view returns (bool) {
        return anchoredTransactions[chainKey][height][keccak256(encodedTransaction)];
    }

    /* ============ ChainInfo (0x0FD3) — supported chains & attestation progress ============ */

    /// @notice Chains supported by Creditcoin validators (real read through the precompile).
    function supportedChains() external view returns (ICreditcoinChainInfo.ChainInfo[] memory) {
        (bool ok, bytes memory ret) = chainInfoPrecompile.staticcall(
            abi.encodeCall(ICreditcoinChainInfo.get_supported_chains, ())
        );
        if (!ok || ret.length < 32) return new ICreditcoinChainInfo.ChainInfo[](0);
        return abi.decode(ret, (ICreditcoinChainInfo.ChainInfo[]));
    }

    function isSupportedChain(uint64 chainKey) external view returns (bool exists) {
        (bool ok, bytes memory ret) = chainInfoPrecompile.staticcall(
            abi.encodeCall(ICreditcoinChainInfo.get_chain_by_key, (chainKey))
        );
        if (!ok || ret.length < 32) return false;
        (, exists) = abi.decode(ret, (ICreditcoinChainInfo.ChainInfo, bool));
        return exists;
    }

    function latestAttestedHeight(uint64 chainKey) external view returns (uint64 height, bool exists) {
        (bool ok, bytes memory ret) = chainInfoPrecompile.staticcall(
            abi.encodeCall(ICreditcoinChainInfo.get_latest_attestation_height_and_hash, (chainKey))
        );
        if (!ok || ret.length < 32) return (0, false);
        (height, , , exists) = abi.decode(ret, (uint64, bytes32, bool, bool));
        return (height, exists);
    }

    function isHeightAttested(uint64 chainKey, uint64 height) external view returns (bool) {
        (bool ok, bytes memory ret) = chainInfoPrecompile.staticcall(
            abi.encodeCall(ICreditcoinChainInfo.is_height_attested, (chainKey, height))
        );
        if (!ok || ret.length < 32) return false;
        return abi.decode(ret, (bool));
    }
}