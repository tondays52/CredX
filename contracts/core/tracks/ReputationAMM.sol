// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationAMM
 * @notice A constant-product Automated Market Maker (AMM) like PancakeSwap.
 *         Trading fees are discounted based on the trader's cross-chain credit score.
 */
contract ReputationAMM is ReentrancyGuard {
    using SafeERC20 for IERC20;

    ICredXHub public immutable CREDX_HUB;
    IERC20 public immutable TOKEN0;
    IERC20 public immutable TOKEN1;

    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public totalSupply;
    mapping(address user => uint256 balance) public balanceOf;

    // Fees in basis points (10000 = 100%)
    uint256 public constant STANDARD_FEE_BPS = 30; // 0.30%
    uint256 public constant PRIME_FEE_BPS = 15;    // 0.15%
    uint256 public constant SUPER_PRIME_FEE_BPS = 5; // 0.05%

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        uint256 feeBps
    );

    constructor(address _credXHub, address _token0, address _token1) {
        require(_credXHub != address(0), "Zero address: credXHub");
        require(_token0 != address(0), "Zero address: token0");
        require(_token1 != address(0), "Zero address: token1");
        CREDX_HUB = ICredXHub(_credXHub);
        TOKEN0 = IERC20(_token0);
        TOKEN1 = IERC20(_token1);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "Zero address: to");
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "Zero address: from");
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }

    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = balance0;
        reserve1 = balance1;
    }

    // Mathematical square root (Babylonian method)
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function addLiquidity(uint256 amount0, uint256 amount1) external nonReentrant returns (uint256 liquidity) {
        TOKEN0.safeTransferFrom(msg.sender, address(this), amount0);
        TOKEN1.safeTransferFrom(msg.sender, address(this), amount1);

        if (totalSupply == 0) {
            liquidity = _sqrt(amount0 * amount1);
        } else {
            uint256 liq0 = (amount0 * totalSupply) / reserve0;
            uint256 liq1 = (amount1 * totalSupply) / reserve1;
            liquidity = liq0 < liq1 ? liq0 : liq1;
        }

        require(liquidity > 0, "Insufficient liquidity minted");
        _mint(msg.sender, liquidity);
        _update(TOKEN0.balanceOf(address(this)), TOKEN1.balanceOf(address(this)));

        emit Mint(msg.sender, amount0, amount1);
    }

    function removeLiquidity(uint256 liquidity) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(balanceOf[msg.sender] >= liquidity, "Insufficient LP balance");

        amount0 = (liquidity * reserve0) / totalSupply;
        amount1 = (liquidity * reserve1) / totalSupply;
        require(amount0 > 0 && amount1 > 0, "Insufficient liquidity burned");

        _burn(msg.sender, liquidity);
        
        TOKEN0.safeTransfer(msg.sender, amount0);
        TOKEN1.safeTransfer(msg.sender, amount1);
        
        _update(TOKEN0.balanceOf(address(this)), TOKEN1.balanceOf(address(this)));

        emit Burn(msg.sender, amount0, amount1);
    }

    function swap(uint256 amount0Out, uint256 amount1Out) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "Insufficient output amount");
        require(amount0Out < reserve0 && amount1Out < reserve1, "Insufficient liquidity");

        uint256 balance0;
        uint256 balance1;

        // Optimistically transfer out
        if (amount0Out > 0) TOKEN0.safeTransfer(msg.sender, amount0Out);
        if (amount1Out > 0) TOKEN1.safeTransfer(msg.sender, amount1Out);

        balance0 = TOKEN0.balanceOf(address(this));
        balance1 = TOKEN1.balanceOf(address(this));

        uint256 amount0In = balance0 > reserve0 - amount0Out ? balance0 - (reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > reserve1 - amount1Out ? balance1 - (reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "Insufficient input amount");

        // Determine fee based on trader's score
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);
        uint256 feeBps = STANDARD_FEE_BPS;

        if (creditScore >= 780) {
            feeBps = SUPER_PRIME_FEE_BPS;
        } else if (creditScore >= 650) {
            feeBps = PRIME_FEE_BPS;
        }

        // Enforce constant product (x * y = k) minus fees
        // (balance0 - amount0In * fee/10000) * (balance1 - amount1In * fee/10000) >= reserve0 * reserve1
        
        uint256 balance0Adjusted = (balance0 * 10000) - (amount0In * feeBps);
        uint256 balance1Adjusted = (balance1 * 10000) - (amount1In * feeBps);
        
        require(
            balance0Adjusted * balance1Adjusted >= reserve0 * reserve1 * (10000**2),
            "K"
        );

        _update(balance0, balance1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, feeBps);
    }

    // Helper for frontend to calculate expected output
    function getAmountOut(uint256 amountIn, address tokenIn, address user) external view returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input amount");
        require(tokenIn != address(0), "Zero address: tokenIn");
        require(user != address(0), "Zero address: user");
        require(tokenIn == address(TOKEN0) || tokenIn == address(TOKEN1), "Invalid token");

        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(user);
        uint256 feeBps = STANDARD_FEE_BPS;
        if (creditScore >= 780) feeBps = SUPER_PRIME_FEE_BPS;
        else if (creditScore >= 650) feeBps = PRIME_FEE_BPS;

        bool isToken0 = tokenIn == address(TOKEN0);
        uint256 reserveIn = isToken0 ? reserve0 : reserve1;
        uint256 reserveOut = isToken0 ? reserve1 : reserve0;

        uint256 amountInWithFee = amountIn * (10000 - feeBps);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 10000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
