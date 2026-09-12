// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ICreditcoinBlockProver } from "../interfaces/ICreditcoinBlockProver.sol";
import { ICreditcoinChainInfo } from "../interfaces/ICreditcoinChainInfo.sol";

/**
 * @title MockBlockProver
 * @notice Local stand-in for the 0x0FD2 BlockProver precompile so Hardhat tests can exercise
 *         BlockProverAttestationOracle without a live Creditcoin node.
 * @dev Acceptance depends only on the Merkle proof root (non-zero == valid), matching the
 *      "proof root committed" contract of the real precompile for test purposes.
 */
contract MockBlockProver is ICreditcoinBlockProver {
    function verify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata
    ) external pure returns (bool) {
        chainKey;
        height;
        encodedTransaction;
        return merkleProof.root != bytes32(0);
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata
    ) external returns (bool) {
        emit TransactionVerified(chainKey, height, 0);
        // Keep the same acceptance rule as the view variant.
        return merkleProof.root != bytes32(0);
    }
}

/**
 * @title MockChainInfo
 * @notice Local stand-in for the 0x0FD3 ChainInfo precompile.
 */
contract MockChainInfo is ICreditcoinChainInfo {
    uint64 public attestedHeight;
    ChainInfo[] public chains;

    constructor() {
        chains.push(ChainInfo({ chainKey: 1, chainId: 11155111, chainName: bytes("Ethereum Sepolia"), chainEncoding: 1 }));
        chains.push(ChainInfo({ chainKey: 2, chainId: 421614, chainName: bytes("Arbitrum Sepolia"), chainEncoding: 1 }));
    }

    function setAttestedHeight(uint64 _height) external {
        attestedHeight = _height;
    }

    function get_supported_chains() external view returns (ChainInfo[] memory) {
        return chains;
    }

    function get_chain_by_key(uint64 chainKey) external view returns (ChainInfo memory info, bool exists) {
        for (uint256 i = 0; i < chains.length; i++) {
            if (chains[i].chainKey == chainKey) {
                return (chains[i], true);
            }
        }
        return (ChainInfo(0, 0, bytes(""), 0), false);
    }

    function is_height_attested(uint64 chainKey, uint64 height) external view returns (bool) {
        if (chainKey == 0) return false;
        return height <= attestedHeight;
    }

    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external
        view
        returns (uint64 height, bytes32 hash, bool isAttestation, bool exists)
    {
        if (chainKey == 0) return (0, bytes32(0), false, false);
        return (attestedHeight, keccak256(abi.encodePacked(chainKey, attestedHeight)), true, true);
    }
}