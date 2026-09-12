// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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

    error ZeroAddress();
    error InvalidAmount();
    error CreditScoreTooLow();
    error InvalidOraclePrice();
    error ZeroSharesMinted();
    error InsufficientShares();
    error InsufficientLiquidity();

    ICredXHub public immutable CREDX_HUB;
    IMockPriceOracle public immutable PRICE_ORACLE;
    IERC20 public immutable STABLECOIN;

    uint256 public constant MIN_SCORE_REQUIRED = 600;
    uint256 public constant PREMIUM_SCORE_THRESHOLD = 750;

    // A premium yield multiplier for high score users when withdrawing.
    // E.g., they get 2% more value back as a loyalty reward.
    uint256 public constant PREMIUM_BONUS_BPS = 200; // 2%

    // The loyalty bonus only vests after the shares have been held for ~30 days (216,000 blocks
    // at 12s/block). This prevents the deposit → instant-withdraw → 2% free-money loop.
    uint256 public constant BONUS_VEST_BLOCKS = 216000;

    // Tracks when each user last deposited, used to gate the premium loyalty bonus.
    mapping(address user => uint256 blockNumber) public lastDepositBlock;

    event Deposit(address indexed user, uint256 stablecoinAmount, uint256 sharesMinted);
    event Withdraw(address indexed user, uint256 sharesBurned, uint256 stablecoinAmount, uint256 bonusAmount);

    constructor(
        address _credXHub,
        address _priceOracle,
        address _stablecoin
    ) ERC20("Treasury Backed USD", "tbUSD") {
        if (_credXHub == address(0) || _priceOracle == address(0) || _stablecoin == address(0)) {
            revert ZeroAddress();
        }
        CREDX_HUB = ICredXHub(_credXHub);
        PRICE_ORACLE = IMockPriceOracle(_priceOracle);
        STABLECOIN = IERC20(_stablecoin);
    }

    /**
     * @notice Deposit stablecoins to mint tbUSD. Requires a credit score >= 600.
     * @param stablecoinAmount The amount of stablecoin to deposit.
     */
    function deposit(uint256 stablecoinAmount) external nonReentrant {
        if (stablecoinAmount == 0) revert InvalidAmount();
        
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);
        if (creditScore < MIN_SCORE_REQUIRED) revert CreditScoreTooLow();

        (uint256 navPrice, uint8 decimals) = PRICE_ORACLE.getLatestPrice();
        if (navPrice == 0) revert InvalidOraclePrice();

        // Calculate shares to mint based on the NAV price of the treasury fund
        // Shares = (Amount * 10^decimals) / navPrice
        uint256 sharesToMint = (stablecoinAmount * (10 ** decimals)) / navPrice;
        if (sharesToMint == 0) revert ZeroSharesMinted();

        STABLECOIN.safeTransferFrom(msg.sender, address(this), stablecoinAmount);
        _mint(msg.sender, sharesToMint);
        lastDepositBlock[msg.sender] = block.number;

        emit Deposit(msg.sender, stablecoinAmount, sharesToMint);
    }

    /**
     * @notice Redeem tbUSD for stablecoins. Premium users get a loyalty bonus.
     * @param sharesAmount The amount of tbUSD to burn.
     */
    function withdraw(uint256 sharesAmount) external nonReentrant {
        if (sharesAmount == 0) revert InvalidAmount();
        if (balanceOf(msg.sender) < sharesAmount) revert InsufficientShares();

        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);

        (uint256 navPrice, uint8 decimals) = PRICE_ORACLE.getLatestPrice();
        if (navPrice == 0) revert InvalidOraclePrice();

        // Base stablecoin output based on current NAV
        uint256 baseStablecoinOut = (sharesAmount * navPrice) / (10 ** decimals);

        uint256 bonusAmount = 0;
        if (creditScore >= PREMIUM_SCORE_THRESHOLD && block.number >= lastDepositBlock[msg.sender] + BONUS_VEST_BLOCKS) {
            // Loyalty bonus has vested: reward long-term premium depositors without inflating
            // the value of a same-block deposit → withdraw cycle.
            bonusAmount = (baseStablecoinOut * PREMIUM_BONUS_BPS) / 10000;
        }

        uint256 totalStablecoinOut = baseStablecoinOut + bonusAmount;
        if (STABLECOIN.balanceOf(address(this)) < totalStablecoinOut) revert InsufficientLiquidity();

        _burn(msg.sender, sharesAmount);
        STABLECOIN.safeTransfer(msg.sender, totalStablecoinOut);

        emit Withdraw(msg.sender, sharesAmount, baseStablecoinOut, bonusAmount);
    }
}
