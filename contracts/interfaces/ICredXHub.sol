// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import {IAttestationVerifier} from "./IAttestationVerifier.sol";

/**
 * @title ICredXHub
 * @notice Interface for the CredX Protocol hub — the first cross-chain credit bureau on Creditcoin.
 * @dev Supports multi-protocol reputation aggregation via Attestcoin / USC verified proofs.
 */
interface ICredXHub {
    // ═══════════════════════════════════════════════════════════════════════
    //  Multi-Protocol Action Types (Weighted Credit Events)
    // ═══════════════════════════════════════════════════════════════════════
    enum ActionType {
        DEFI_LOAN_REPAYMENT,      // 0 — Repaying loan on Aave/Compound (weight: 1.5x)
        COMPOUND_SUPPLY,          // 1 — Supplying collateral to Compound (weight: 1.0x)
        UNISWAP_LP_PROVISION,     // 2 — Providing liquidity on Uniswap v2/v3 (weight: 1.2x)
        ENS_IDENTITY,             // 3 — ENS name registration (identity signal) (weight: 0.5x)
        STABLECOIN_TRANSFER,      // 4 — Large stablecoin transfer (>$10k) (weight: 0.8x)
        RWA_INVOICE_SETTLEMENT,   // 5 — B2B trade finance / invoice settlement (weight: 1.8x)
        STAKING_COLLATERAL_LOCK,  // 6 — Long-term staking/collateral commitment (weight: 1.3x)
        ONCHAIN_IDENTITY_VERIFIED // 7 — Gitcoin Passport / WorldID attestation (weight: 0.4x)
    }

    struct VerifiedAttestationRecord {
        bytes32 proofHash;
        uint256 sourceChainId;
        bytes32 txHash;
        address borrower;
        ActionType actionType;
        uint256 valueUSD;         // Normalized USD value (with 18 decimals)
        uint256 sourceTimestamp;
        uint256 verifiedAt;
        bytes32 privacyCommitment; // Commitment hash for privacy-preserving proof storage
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Core Functions
    // ═══════════════════════════════════════════════════════════════════════
    function submitRepaymentProof(
        IAttestationVerifier.EventProof calldata proof,
        ActionType actionType,
        uint256 reportedValueUSD
    ) external returns (bool success, uint256 newScore);

    function submitBatchProofs(
        IAttestationVerifier.EventProof[] calldata proofs,
        ActionType[] calldata actionTypes,
        uint256[] calldata reportedValuesUSD
    ) external returns (uint256 finalScore);

    function getBorrowerProfile(address borrower) external view returns (
        uint256 creditScore,
        uint256 totalVerifiedVolumeUSD,
        uint256 totalAttestationsCount,
        uint256 maxCreditLineUSD,
        uint256 requiredCollateralRatioBps,
        uint256 lastAttestationTimestamp
    );
}
