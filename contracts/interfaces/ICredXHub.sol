// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAttestationVerifier.sol";

interface ICredXHub {
    enum ActionType {
        DEFI_LOAN_REPAYMENT,     // Repaying loan on Aave/Compound on Ethereum
        RWA_INVOICE_SETTLEMENT,  // B2B trade finance / invoice settlement on Ethereum
        STAKING_COLLATERAL_LOCK, // Long-term collateral / staking commitment
        ONCHAIN_IDENTITY_VERIFIED// Proof of KYC/KYB / Gitcoin Passport / WorldID attestation
    }

    struct VerifiedAttestationRecord {
        bytes32 proofHash;
        uint256 sourceChainId;
        bytes32 txHash;
        address borrower;
        ActionType actionType;
        uint256 valueUSD;       // Normalized USD value (with 18 decimals)
        uint256 sourceTimestamp;
        uint256 verifiedAt;
    }

    event ProofSubmittedAndVerified(
        bytes32 indexed proofHash,
        address indexed borrower,
        uint256 sourceChainId,
        bytes32 txHash,
        ActionType actionType,
        uint256 valueUSD,
        uint256 newCreditScore
    );

    event CreditScoreUpdated(
        address indexed borrower,
        uint256 oldScore,
        uint256 newScore,
        uint256 maxCreditLineUSD,
        uint256 requiredCollateralRatioBps
    );

    function submitRepaymentProof(
        IAttestationVerifier.EventProof calldata proof,
        ActionType actionType,
        uint256 reportedValueUSD
    ) external returns (bool success, uint256 newScore);

    function getBorrowerProfile(address borrower) external view returns (
        uint256 creditScore,
        uint256 totalVerifiedVolumeUSD,
        uint256 totalAttestationsCount,
        uint256 maxCreditLineUSD,
        uint256 requiredCollateralRatioBps,
        uint256 lastAttestationTimestamp
    );
}
