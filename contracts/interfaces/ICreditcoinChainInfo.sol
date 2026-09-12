// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;


/**
 * @title ICreditcoinChainInfo
 * @notice ABI subset of Creditcoin's ChainInfo precompile (0x0FD3) used by this project.
 * @dev Mirrors the selectors documented in @gluwa/usc-sdk (dist/chain-info/chain_info.json).
 */
interface ICreditcoinChainInfo {

    struct ChainInfo {
        uint64 chainKey;      // Creditcoin internal key for the source chain
        uint64 chainId;       // EVM chain id (e.g. 11155111 for Ethereum Sepolia)
        bytes chainName;      // Human readable name (may be empty on some nodes)
        uint8 chainEncoding;  // 1 = EVM
    }

    /// @notice All source chains currently supported by Creditcoin validators.
    function get_supported_chains() external view returns (ChainInfo[] memory);

    /// @notice Looks up a chain by its Creditcoin chain key.
    function get_chain_by_key(uint64 chainKey) external view returns (ChainInfo memory info, bool exists);

    /// @notice True when the given source-chain height has been attested by validators.
    function is_height_attested(uint64 chainKey, uint64 height) external view returns (bool);

    /// @notice Latest attested height and its rollup-root hash for a chain.
    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external view returns (uint64 height, bytes32 hash, bool isAttestation, bool exists);
}