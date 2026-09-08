// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICredXHub.sol";

/**
 * @title CreditScoreEngine
 * @notice Mathematical engine that derives onchain Creditcoin Trust Scores (CTS)
 *         and determines collateral ratios and credit lines based on Attestcoin verified facts.
 */
contract CreditScoreEngine {
    uint256 public constant MIN_SCORE = 300;
    uint256 public constant MAX_SCORE = 850;
    uint256 public constant BASE_SCORE = 450;

    // Basis points constant (100% = 10000)
    uint256 public constant BPS_DIVISOR = 10000;

    address public credXHub;
    address public owner;

    modifier onlyCredXHub() {
        require(msg.sender == credXHub || msg.sender == owner, "Unauthorized: Only CredXHub");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setCredXHub(address _credXHub) external {
        require(msg.sender == owner, "Only owner");
        credXHub = _credXHub;
    }

    /**
     * @notice Computes a normalized credit score (300 - 850) based on verified cross-chain history.
     * @param totalVerifiedVolumeUSD Cumulative USD volume verified via Attestcoin (18 decimals).
     * @param attestationsCount Number of verified cross-chain actions.
     * @param lastAttestationTimestamp Unix timestamp of the most recent verified event.
     * @param isMainnetSource True if proven from Ethereum Mainnet (Chain ID 1).
     */
    function computeScore(
        uint256 totalVerifiedVolumeUSD,
        uint256 attestationsCount,
        uint256 lastAttestationTimestamp,
        bool isMainnetSource
    ) public view returns (uint256 score) {
        if (attestationsCount == 0) {
            return MIN_SCORE;
        }

        uint256 calculatedScore = BASE_SCORE;

        // 1. Volume Score Contribution (Up to +250 points)
        // Normalized: $1k = +30pts, $10k = +90pts, $50k = +160pts, $100k+ = +250pts
        uint256 volumeInUSDUnits = totalVerifiedVolumeUSD / 10**18;
        if (volumeInUSDUnits >= 100_000) {
            calculatedScore += 250;
        } else if (volumeInUSDUnits >= 50_000) {
            calculatedScore += 180;
        } else if (volumeInUSDUnits >= 10_000) {
            calculatedScore += 110;
        } else if (volumeInUSDUnits >= 1_000) {
            calculatedScore += 50;
        } else {
            calculatedScore += (volumeInUSDUnits * 50) / 1000;
        }

        // 2. Frequency / Track Record Contribution (Up to +100 points)
        // 1 tx = 20 pts, 5 txs = 60 pts, 10+ txs = 100 pts
        if (attestationsCount >= 10) {
            calculatedScore += 100;
        } else {
            calculatedScore += (attestationsCount * 10);
        }

        // 3. Recency Bonus (Up to +50 points)
        // If attested in the last 30 days
        if (lastAttestationTimestamp != 0 && (block.timestamp >= lastAttestationTimestamp) && (block.timestamp - lastAttestationTimestamp) <= 30 days) {
            calculatedScore += 50;
        }

        // 4. Mainnet Source Quality Boost (+20 points for high-gas L1 verification)
        if (isMainnetSource) {
            calculatedScore += 20;
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
     * @notice Determines the required collateral ratio based on credit score.
     * @param score CTS Credit score (300 - 850).
     * @return collateralRatioBps Collateral ratio in basis points (e.g. 7000 = 70%, 15000 = 150%).
     */
    function getCollateralRatio(uint256 score) public pure returns (uint256 collateralRatioBps) {
        if (score >= 780) {
            return 7000;  // 70% collateral required (Prime Tier - 30% undercollateralized!)
        } else if (score >= 700) {
            return 8500;  // 85% collateral required (Gold Tier)
        } else if (score >= 650) {
            return 9500;  // 95% collateral required (Silver Tier - Undercollateralized!)
        } else if (score >= 580) {
            return 12000; // 120% collateral required (Bronze Tier)
        } else {
            return 15000; // 150% collateral required (Standard Overcollateralized)
        }
    }

    /**
     * @notice Calculates the maximum credit line in USD for a given borrower profile.
     * @param score CTS Credit score (300 - 850).
     * @param totalVerifiedVolumeUSD Cumulative verified USD volume.
     */
    function getMaxCreditLine(uint256 score, uint256 totalVerifiedVolumeUSD) public pure returns (uint256 maxCreditUSD) {
        if (score < 500) {
            return 1_000 * 10**18; // $1,000 baseline
        }
        
        // Allowed to borrow up to 50% - 150% of verified historical repayment volume based on tier
        uint256 multiplierBps;
        if (score >= 780) {
            multiplierBps = 15000; // 150% of verified track record
        } else if (score >= 700) {
            multiplierBps = 10000; // 100%
        } else {
            multiplierBps = 5000;  // 50%
        }

        uint256 allowedFromVolume = (totalVerifiedVolumeUSD * multiplierBps) / BPS_DIVISOR;
        uint256 minimumTierCredit = (score - 300) * 100 * 10**18; // Base guarantee

        return allowedFromVolume > minimumTierCredit ? allowedFromVolume : minimumTierCredit;
    }

    /**
     * @notice Returns the interest rate discount in basis points.
     * @param score CTS Credit score (300 - 850).
     */
    function getInterestRateDiscountBps(uint256 score) public pure returns (uint256 discountBps) {
        if (score >= 780) {
            return 300; // 3.0% interest rate reduction
        } else if (score >= 700) {
            return 200; // 2.0% reduction
        } else if (score >= 620) {
            return 100; // 1.0% reduction
        }
        return 0;
    }
}
