// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IMockPriceOracle} from "../../interfaces/IMockPriceOracle.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RWATreasuryYieldFund
 * @notice An Institutional Treasury Yield Fund (inspired by Ondo Finance and Securitize).
 *         Users deposit stablecoins to mint Treasury-Backed USD (tbUSD).
 *         The Attestcoin Protocol cross-chain score serves as decentralized KYC.
 *         The exchange rate is determined by a Chainlink-style Mock Oracle.
 */
contract RWATreasuryYieldFund is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ICredXHub public immutable credXHub;
    IMockPriceOracle public immutable priceOracle;
    IERC20 public immutable stablecoin;

    uint256 public constant MIN_SCORE_REQUIRED = 600;
    uint256 public constant PREMIUM_SCORE_THRESHOLD = 750;

    // A premium yield multiplier for high score users when withdrawing.
    // E.g., they get 2% more value back as a loyalty reward.
    uint256 public constant PREMIUM_BONUS_BPS = 200; // 2%

    event Deposit(address indexed user, uint256 stablecoinAmount, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 sharesBurned, uint256 stablecoinAmount, uint256 bonusAmount);

    constructor(
        address _credXHub,
        address _priceOracle,
        address _stablecoin
    ) ERC20("Treasury Backed USD", "tbUSD") {
        credXHub = ICredXHub(_credXHub);
        priceOracle = IMockPriceOracle(_priceOracle);
        stablecoin = IERC20(_stablecoin);
    }

    /**
     * @notice Deposit stablecoins to mint tbUSD. Requires a credit score >= 600.
     * @param stablecoinAmount The amount of stablecoin to deposit.
     */
    function deposit(uint256 stablecoinAmount) external nonReentrant {
        require(stablecoinAmount > 0, "Amount must be > 0");
        
        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        require(creditScore >= MIN_SCORE_REQUIRED, "Credit score too low for institutional fund");

        (uint256 navPrice, uint8 decimals) = priceOracle.getLatestPrice();
        require(navPrice > 0, "Invalid Oracle Price");

        // Calculate shares to mint based on the NAV price of the treasury fund
        // Shares = (Amount * 10^decimals) / navPrice
        uint256 sharesToMint = (stablecoinAmount * (10 ** decimals)) / navPrice;
        require(sharesToMint > 0, "Zero shares minted");

        stablecoin.safeTransferFrom(msg.sender, address(this), stablecoinAmount);
        _mint(msg.sender, sharesToMint);

        emit Deposit(msg.sender, stablecoinAmount, sharesToMint);
    }

    /**
     * @notice Redeem tbUSD for stablecoins. Premium users get a loyalty bonus.
     * @param sharesAmount The amount of tbUSD to burn.
     */
    function withdraw(uint256 sharesAmount) external nonReentrant {
        require(sharesAmount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= sharesAmount, "Insufficient shares");

        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);

        (uint256 navPrice, uint8 decimals) = priceOracle.getLatestPrice();
        require(navPrice > 0, "Invalid Oracle Price");

        // Base stablecoin output based on current NAV
        uint256 baseStablecoinOut = (sharesAmount * navPrice) / (10 ** decimals);

        uint256 bonusAmount = 0;
        if (creditScore >= PREMIUM_SCORE_THRESHOLD) {
            // Give the user an extra X% as a loyalty/premium reward
            bonusAmount = (baseStablecoinOut * PREMIUM_BONUS_BPS) / 10000;
        }

        uint256 totalStablecoinOut = baseStablecoinOut + bonusAmount;
        require(stablecoin.balanceOf(address(this)) >= totalStablecoinOut, "Insufficient vault liquidity");

        _burn(msg.sender, sharesAmount);
        stablecoin.safeTransfer(msg.sender, totalStablecoinOut);

        emit Withdraw(msg.sender, sharesAmount, baseStablecoinOut, bonusAmount);
    }
}
