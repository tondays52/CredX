// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICredXHub.sol";

/**
 * @title CreditScoreEngine
 * @notice OCCR-inspired (On-Chain Credit Risk) multi-factor scoring engine for CredX.
 * @dev Implements a weighted, multi-dimensional credit risk model grounded in 
 *      academic research ("On-Chain Credit Risk Score in DeFi", 2025/2026).
 *      
 * Scoring Dimensions:
 *   1. Verified Volume (USD)        — Up to +200 points
 *   2. Protocol Diversity           — Up to +80 points  
 *   3. Chain Diversity              — Up to +40 points
 *   4. Attestation Frequency        — Up to +80 points
 *   5. Recency                      — Up to +50 points
 *   6. Mainnet Source Quality       — Up to +20 points
 *   7. Action Type Weighted Bonus   — Up to +80 points
 */
contract CreditScoreEngine {
    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 850;
    uint256 public constant BASE_SCORE = 350;

    // Basis points constant (100% = 10000)
    uint256 public constant BPS_DIVISOR = 10000;

    address public credXHub;
    address public owner;

    // ═══════════════════════════════════════════════════════════════════════
    //  Dynamic APR Tiers (Score → Annual Interest Rate)
    // ═══════════════════════════════════════════════════════════════════════
    //  Super-Prime (780+):  250 bps = 2.5%
    //  Prime (650-779):     500 bps = 5.0%
    //  Near-Prime (500-649):800 bps = 8.0%
    //  Subprime (300-499): 1200 bps = 12.0%

    // Weight multipliers per ActionType (in basis points — 10000 = 1.0x)
    // Higher weight = more valuable contribution to credit score
    uint256[8] public actionWeights;

    modifier onlyCredXHub() {
        require(msg.sender == credXHub || msg.sender == owner, "Unauthorized: Only CredXHub");
        _;
    }

    constructor() {
        owner = msg.sender;
        
        // Initialize action type weights (BPS: 10000 = 1.0x multiplier)
        actionWeights[0] = 15000;  // DEFI_LOAN_REPAYMENT: 1.5x (highest DeFi signal)
        actionWeights[1] = 10000;  // COMPOUND_SUPPLY: 1.0x
        actionWeights[2] = 12000;  // UNISWAP_LP_PROVISION: 1.2x (shows commitment)
        actionWeights[3] = 5000;   // ENS_IDENTITY: 0.5x (identity signal)
        actionWeights[4] = 8000;   // STABLECOIN_TRANSFER: 0.8x
        actionWeights[5] = 18000;  // RWA_INVOICE_SETTLEMENT: 1.8x (highest real-world signal)
        actionWeights[6] = 13000;  // STAKING_COLLATERAL_LOCK: 1.3x
        actionWeights[7] = 4000;   // ONCHAIN_IDENTITY_VERIFIED: 0.4x
    }

    function setCredXHub(address _credXHub) external {
        require(msg.sender == owner, "Only owner");
        credXHub = _credXHub;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OCCR Multi-Factor Credit Score Computation
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Computes an OCCR-inspired credit score (300 - 850) using multiple risk dimensions.
     * @param totalVerifiedVolumeUSD Cumulative USD volume verified via Attestcoin (18 decimals).
     * @param attestationsCount Number of verified cross-chain actions.
     * @param lastAttestationTimestamp Unix timestamp of the most recent verified event.
     * @param isMainnetSource True if proven from Ethereum Mainnet (Chain ID 1).
     * @param protocolDiversity Number of unique DeFi protocol types attested.
     * @param chainDiversity Number of unique source chains attested from.
     * @param weightedActionScore Cumulative weighted action score from multi-protocol proofs.
     */
    function computeScoreMultiFactor(
        uint256 totalVerifiedVolumeUSD,
        uint256 attestationsCount,
        uint256 lastAttestationTimestamp,
        bool isMainnetSource,
        uint256 protocolDiversity,
        uint256 chainDiversity,
        uint256 weightedActionScore
    ) public view returns (uint256 score) {
        if (attestationsCount == 0) {
            return MIN_SCORE;
        }

        uint256 calculatedScore = BASE_SCORE;

        // ─── Dimension 1: Volume Score (Up to +200 points) ───
        uint256 volumeInUSDUnits = totalVerifiedVolumeUSD / 10**18;
        if (volumeInUSDUnits >= 100_000) {
            calculatedScore += 200;
        } else if (volumeInUSDUnits >= 50_000) {
            calculatedScore += 160;
        } else if (volumeInUSDUnits >= 10_000) {
            calculatedScore += 100;
        } else if (volumeInUSDUnits >= 1_000) {
            calculatedScore += 50;
        } else {
            calculatedScore += (volumeInUSDUnits * 50) / 1000;
        }

        // ─── Dimension 2: Protocol Diversity (Up to +80 points) ───
        // Using 3+ different DeFi protocols signals sophisticated, diversified behavior
        if (protocolDiversity >= 5) {
            calculatedScore += 80;
        } else if (protocolDiversity >= 3) {
            calculatedScore += 50;
        } else if (protocolDiversity >= 2) {
            calculatedScore += 25;
        }

        // ─── Dimension 3: Chain Diversity (Up to +40 points) ───
        // Proving activity across multiple chains
        if (chainDiversity >= 3) {
            calculatedScore += 40;
        } else if (chainDiversity >= 2) {
            calculatedScore += 20;
        }

        // ─── Dimension 4: Attestation Frequency (Up to +80 points) ───
        if (attestationsCount >= 15) {
            calculatedScore += 80;
        } else if (attestationsCount >= 10) {
            calculatedScore += 60;
        } else if (attestationsCount >= 5) {
            calculatedScore += 40;
        } else {
            calculatedScore += (attestationsCount * 8);
        }

        // ─── Dimension 5: Recency Bonus (Up to +50 points) ───
        if (lastAttestationTimestamp != 0 && (block.timestamp >= lastAttestationTimestamp) && (block.timestamp - lastAttestationTimestamp) <= 30 days) {
            calculatedScore += 50;
        } else if (lastAttestationTimestamp != 0 && (block.timestamp >= lastAttestationTimestamp) && (block.timestamp - lastAttestationTimestamp) <= 90 days) {
            calculatedScore += 25;
        }

        // ─── Dimension 6: Mainnet Source Quality (+20 points) ───
        if (isMainnetSource) {
            calculatedScore += 20;
        }

        // ─── Dimension 7: Weighted Action Bonus (Up to +80 points) ───
        // Based on cumulative weighted scores from diverse action types
        uint256 normalizedActionBonus = weightedActionScore / 10**18;
        if (normalizedActionBonus >= 50) {
            calculatedScore += 80;
        } else if (normalizedActionBonus >= 20) {
            calculatedScore += 50;
        } else if (normalizedActionBonus >= 5) {
            calculatedScore += 25;
        }

        // Cap score within [MIN_SCORE, MAX_SCORE]
        if (calculatedScore > MAX_SCORE) {
            calculatedScore = MAX_SCORE;
        }
        if (calculatedScore < MIN_SCORE) {
            calculatedScore = MIN_SCORE;
        }

        return calculatedScore;
    }

    /**
     * @notice Legacy scoring function for backward compatibility.
     */
    function computeScore(
        uint256 totalVerifiedVolumeUSD,
        uint256 attestationsCount,
        uint256 lastAttestationTimestamp,
        bool isMainnetSource
    ) public view returns (uint256 score) {
        return computeScoreMultiFactor(
            totalVerifiedVolumeUSD,
            attestationsCount,
            lastAttestationTimestamp,
            isMainnetSource,
            1,  // Default protocol diversity
            1,  // Default chain diversity
            0   // No weighted action score in legacy mode
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Collateral Ratio Tiers
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Determines the required collateral ratio based on credit score.
     * @return collateralRatioBps Collateral ratio in basis points (7000 = 70%, 15000 = 150%).
     */
    function getCollateralRatio(uint256 score) public pure returns (uint256 collateralRatioBps) {
        if (score >= 780) {
            return 7000;   // Super-Prime: 70% collateral (30% under-collateralized!)
        } else if (score >= 700) {
            return 8500;   // Prime: 85% collateral
        } else if (score >= 650) {
            return 9500;   // Near-Prime: 95% collateral
        } else if (score >= 580) {
            return 12000;  // Standard: 120% collateral
        } else {
            return 15000;  // Subprime: 150% collateral (fully overcollateralized)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Dynamic APR Engine (Score → Interest Rate)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Returns the annual interest rate in basis points based on credit score.
     * @dev This replaces the old discount-based model with a direct APR mapping,
     *      mirroring how traditional credit markets (FICO → APR) work.
     */
    function getInterestRate(uint256 score) public pure returns (uint256 interestRateBps) {
        if (score >= 780) {
            return 250;   // Super-Prime: 2.5% APR
        } else if (score >= 650) {
            return 500;   // Prime: 5.0% APR
        } else if (score >= 500) {
            return 800;   // Near-Prime: 8.0% APR
        } else {
            return 1200;  // Subprime: 12.0% APR
        }
    }

    /**
     * @notice Legacy discount function — now derives from the direct APR tiers.
     */
    function getInterestRateDiscountBps(uint256 score) public pure returns (uint256 discountBps) {
        uint256 baseRate = 800; // 8% base
        uint256 rate = getInterestRate(score);
        if (rate < baseRate) {
            return baseRate - rate;
        }
        return 0;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Credit Line Calculator
    // ═══════════════════════════════════════════════════════════════════════

    function getMaxCreditLine(uint256 score, uint256 totalVerifiedVolumeUSD) public pure returns (uint256 maxCreditUSD) {
        if (score < 500) {
            return 1_000 * 10**18; // $1,000 baseline
        }
        
        uint256 multiplierBps;
        if (score >= 780) {
            multiplierBps = 15000; // 150% of verified track record
        } else if (score >= 700) {
            multiplierBps = 10000; // 100%
        } else {
            multiplierBps = 5000;  // 50%
        }

        uint256 allowedFromVolume = (totalVerifiedVolumeUSD * multiplierBps) / BPS_DIVISOR;
        uint256 minimumTierCredit = (score - 300) * 100 * 10**18;

        return allowedFromVolume > minimumTierCredit ? allowedFromVolume : minimumTierCredit;
    }

    /**
     * @notice Returns the action weight multiplier for a given ActionType.
     */
    function getActionWeight(uint256 actionTypeIndex) public view returns (uint256) {
        require(actionTypeIndex < 8, "Invalid action type");
        return actionWeights[actionTypeIndex];
    }
}
