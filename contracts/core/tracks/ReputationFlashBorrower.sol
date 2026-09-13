// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IFlashBorrower} from "../../interfaces/IFlashBorrower.sol";
import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * Minimal surface of the deployed ReputationAMM used to compute the real
 * projected round-trip and to execute the atomic swap legs (Uniswap-style:
 * input tokens reach the AMM first, then swap(amount0Out, amount1Out) is
 * called and the input is measured from the balance delta).
 */
interface IReputationAMM {
    function getAmountOut(uint256 amountIn, address tokenIn, address user) external view returns (uint256 amountOut);
    function swap(uint256 amount0Out, uint256 amount1Out) external;
}

/**
 * @title ReputationFlashBorrower
 * @notice Real ERC-3156 flash-loan receiver for the CredX DeFi panel.
 *
 * The receiver holds a small cUSD "executor float" (funded by the demo wallet)
 * so the borrowed principal plus the live credit-tier fee can always be repaid
 * to ReputationFlashLoan within the same block via its max allowance.
 *
 * Two execution modes are encoded in `data` as abi.encode(uint256 mode, address profitTo):
 *   mode 0 — AUDIT & RETURN        Atomically proves the loan: liquidity is parked,
 *                                  the live AMM round-trip projection is recorded to
 *                                  lastAudit and the principal + fee is repaid. The
 *                                  sponsor float absorbs the fee so borrowers pay $0.
 *   mode 1 — AMM ROUND-TRIP        All-or-nothing arbitrage attempt: the round-trip
 *                                  is executed ONLY when the exact constant-product
 *                                  math (post-first-leg reserves) nets >= the live
 *                                  flash fee. Otherwise the whole transaction reverts
 *                                  atomically (NoProfit) — nothing moves.
 *
 * The projection math mirrors the AMM's getAmountOut() fee-adjusted invariant for the
 * receiver's OWN credit tier (the address that actually calls swap()).
 */
contract ReputationFlashBorrower is IFlashBorrower {
    using SafeERC20 for IERC20;

    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    address public immutable FLASH_LOAN;
    address public immutable INITIATOR;
    ICredXHub public immutable CREDX_HUB;
    IReputationAMM public immutable AMM;
    IERC20 public immutable TOKEN0; // cUSD
    IERC20 public immutable TOKEN1; // DEPIN
    IERC20 public immutable TOKEN;  // repayment asset (cUSD)

    struct Audit {
        uint256 blockNumber;
        uint256 amount;
        uint256 fee;
        uint256 feeBps;
        uint256 score;
        uint256 projectedDepin; // cUSD -> DEPIN (live reserves, first leg)
        uint256 projectedBack;  // DEPIN -> cUSD (post-first-leg reserves, exact)
        bool profitable;
    }
    Audit public lastAudit;

    event AuditExecuted(address indexed initiator, uint256 amount, uint256 fee, uint256 score, bool profitable);

    error Unauthorized();
    error NoProfit();

    constructor(
        address _credXHub,
        address _amm,
        address _flashLoan,
        address _token0,
        address _token1,
        address _initiator
    ) {
        CREDX_HUB = ICredXHub(_credXHub);
        AMM = IReputationAMM(_amm);
        FLASH_LOAN = _flashLoan;
        TOKEN0 = IERC20(_token0);
        TOKEN1 = IERC20(_token1);
        TOKEN = IERC20(_token0);
        INITIATOR = _initiator;
        // Max allowance → the lender can always pull principal + fee back.
        TOKEN0.approve(_flashLoan, type(uint256).max);
    }

    /// @notice Reputation fee tier (bps) of a caller, mirroring ReputationFlashLoan.
    function reputationFeeBps(address who) public view returns (uint256) {
        (uint256 score, , , , , ) = CREDX_HUB.getBorrowerProfile(who);
        if (score >= 780) return 1;
        if (score >= 650) return 5;
        return 9;
    }

    /// @notice AMM fee tier (bps) the receiver pays when IT swaps (its own score).
    function ammFeeBps() public view returns (uint256) {
        (uint256 score, , , , , ) = CREDX_HUB.getBorrowerProfile(address(this));
        if (score >= 780) return 5;
        if (score >= 650) return 15;
        return 30;
    }

    /// @notice Live indefinite-integral-free projection for `amount` cUSD through the
    ///         AMM round trip, using the receiver's own swap fee tier and the EXACT
    ///         post-first-leg reserves (mirrors getAmountOut() both legs).
    function projectRoundTrip(uint256 amount) public view returns (uint256 depinOut, uint256 cusdBack) {
        uint256 f1 = ammFeeBps();
        uint256 f2 = ammFeeBps();
        uint256 r0 = TOKEN0.balanceOf(address(AMM));
        uint256 r1 = TOKEN1.balanceOf(address(AMM));

        // cUSD -> DEPIN (first leg, current reserves)
        uint256 inWithFee1 = (amount * (10000 - f1)) / 10000;
        depinOut = (inWithFee1 * r1) / (r0 + inWithFee1);

        // DEPIN -> cUSD (second leg, EXACT post-first-leg reserves)
        uint256 r0p = r0 + amount;
        uint256 r1p = r1 - depinOut;
        uint256 inWithFee2 = (depinOut * (10000 - f2)) / 10000;
        cusdBack = (inWithFee2 * r0p) / (r1p + inWithFee2);
    }

    function onFlashLoan(
        address initiator,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        if (msg.sender != FLASH_LOAN) revert Unauthorized();

        (uint256 mode, address profitTo) = data.length >= 64
            ? abi.decode(data, (uint256, address))
            : (uint256(0), address(0));

        (uint256 depinOut, uint256 cusdBack) = projectRoundTrip(amount);
        bool profitable = cusdBack >= amount + fee;
        uint256 feeBps = reputationFeeBps(initiator);
        (uint256 score, , , , , ) = CREDX_HUB.getBorrowerProfile(initiator);

        lastAudit = Audit(block.number, amount, fee, feeBps, score, depinOut, cusdBack, profitable);

        if (mode == 1) {
            // AMM ROUND-TRIP — all-or-nothing. When the exact math nets below the live
            // fee the entire transaction reverts, protecting the borrower atomically.
            if (!profitable) revert NoProfit();

            // Leg 1: cUSD -> DEPIN
            TOKEN0.safeTransfer(address(AMM), amount);
            AMM.swap(0, depinOut);

            // Leg 2: DEPIN -> cUSD
            TOKEN1.safeTransfer(address(AMM), depinOut);
            AMM.swap(cusdBack, 0);

            // Profit = back - (principal + fee); lender pulls principal + fee via
            // the max allowance afterwards.
            if (profitTo != address(0) && cusdBack > amount + fee) {
                TOKEN0.safeTransfer(profitTo, cusdBack - (amount + fee));
            }
            emit AuditExecuted(initiator, amount, fee, score, true);
        } else {
            // AUDIT & RETURN — liquidity is parked, principal + fee is repaid in the
            // same block by the lender (float covers the fee). Nothing is executed
            // on the AMM; the projection is recorded so the UI shows real numbers.
            emit AuditExecuted(initiator, amount, fee, score, profitable);
        }

        return CALLBACK_SUCCESS;
    }
}