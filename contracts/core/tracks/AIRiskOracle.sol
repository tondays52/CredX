// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

    uint256 public lastUpdated;

    event RiskParametersUpdated(uint256 volatilityIndex, uint256 defaultRate, uint256 timestamp);

    modifier onlyAIAgent() {
        require(msg.sender == aiAgent, "Only AI agent can call");
        _;
    }

    constructor(address _aiAgent) {
        require(_aiAgent != address(0), "Invalid AI agent");
        aiAgent = _aiAgent;
        marketVolatilityIndex = 1000; // 10% default
        globalDefaultRateBps = 200;   // 2% default
        lastUpdated = block.timestamp;
    }

    function updateRiskParameters(uint256 _volatilityIndex, uint256 _defaultRateBps) external onlyAIAgent {
        require(_volatilityIndex <= 10000, "Invalid volatility");
        require(_defaultRateBps <= 10000, "Invalid default rate");

        marketVolatilityIndex = _volatilityIndex;
        globalDefaultRateBps = _defaultRateBps;
        lastUpdated = block.timestamp;

        emit RiskParametersUpdated(_volatilityIndex, _defaultRateBps, block.timestamp);
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
