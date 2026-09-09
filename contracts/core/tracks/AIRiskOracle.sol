// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title AIRiskOracle
 * @notice An autonomous oracle where an AI Agent pushes real-time risk vectors on-chain.
 *         These vectors can be queried by lending pools to adjust base APRs dynamically.
 */
contract AIRiskOracle {

    address public aiAgent;
    
    // Ranges from 0 to 10000 (100% volatility)
    uint256 public marketVolatilityIndex;
    
    // Ranges from 0 to 10000 (bps)
    uint256 public globalDefaultRateBps;

    uint256 public lastUpdatedBlock;

    // Custom Errors (Gas-efficient alternative to string requires)
    error NotAIAgent();
    error InvalidAIAgent();
    error InvalidVolatility();
    error InvalidDefaultRate();

    event RiskParametersUpdated(uint256 volatilityIndex, uint256 defaultRate, uint256 blockNumber);

    modifier onlyAIAgent() {
        if (msg.sender != aiAgent) {
            revert NotAIAgent();
        }
        _;
    }

    constructor(address _aiAgent) {
        if (_aiAgent == address(0)) {
            revert InvalidAIAgent();
        }
        aiAgent = _aiAgent;
        marketVolatilityIndex = 1000; // 10% default
        globalDefaultRateBps = 200;   // 2% default
        lastUpdatedBlock = block.number;
    }

    function updateRiskParameters(uint256 _volatilityIndex, uint256 _defaultRateBps) external onlyAIAgent {
        if (_volatilityIndex > 10000) {
            revert InvalidVolatility();
        }
        if (_defaultRateBps > 10000) {
            revert InvalidDefaultRate();
        }

        marketVolatilityIndex = _volatilityIndex;
        globalDefaultRateBps = _defaultRateBps;
        lastUpdatedBlock = block.number;

        emit RiskParametersUpdated(_volatilityIndex, _defaultRateBps, block.number);
    }

    /**
     * @notice Computes a dynamic Base APR based on current AI risk vectors.
     * @return baseAprBps The computed base APR in basis points.
     */
    function getAdjustedBaseAPR() external view returns (uint256 baseAprBps) {
        // Base APR starts at 5% (500 bps)
        // Add a premium for high volatility (e.g., if volatility is 2000 (20%), add 200 bps)
        // Add a premium for high default rates (e.g., if default rate is 500 (5%), add 500 bps)
        
        uint256 volatilityPremium = marketVolatilityIndex / 10; 
        uint256 defaultRiskPremium = globalDefaultRateBps;

        baseAprBps = 500 + volatilityPremium + defaultRiskPremium;
        
        // Cap at 30% (3000 bps)
        if (baseAprBps > 3000) {
            baseAprBps = 3000;
        }
    }
}
