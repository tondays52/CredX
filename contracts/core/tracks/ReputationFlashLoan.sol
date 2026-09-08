// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFlashBorrower {
    function onFlashLoan(address initiator, uint256 amount, uint256 fee, bytes calldata data) external returns (bytes32);
}

/**
 * @title ReputationFlashLoan
 * @notice Offers discounted flash loans to users with high cross-chain credit scores.
 */
contract ReputationFlashLoan {
    using SafeERC20 for IERC20;

    ICredXHub public immutable credXHub;
    IERC20 public immutable token;

    // Fees are in basis points (10000 = 100%)
    uint256 public constant STANDARD_FEE_BPS = 9; // 0.09% (like Aave)
    uint256 public constant PRIME_FEE_BPS = 5;    // 0.05%
    uint256 public constant SUPER_PRIME_FEE_BPS = 1; // 0.01%

    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    event FlashLoan(address indexed receiver, address indexed token, uint256 amount, uint256 fee, uint256 score);

    constructor(address _credXHub, address _token) {
        credXHub = ICredXHub(_credXHub);
        token = IERC20(_token);
    }

    /**
     * @notice Execute a flash loan with reputation-based discounts.
     * @param receiver The address receiving the flash loan (must implement IFlashBorrower).
     * @param amount The amount of tokens to borrow.
     * @param data Arbitrary data passed to the receiver.
     */
    function flashLoan(address receiver, uint256 amount, bytes calldata data) external {
        require(amount > 0, "Amount must be > 0");
        require(token.balanceOf(address(this)) >= amount, "Not enough liquidity");

        // Determine fee based on caller's credit score (not the receiver contract, but the initiator)
        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        uint256 feeBps = STANDARD_FEE_BPS;

        if (creditScore >= 780) {
            feeBps = SUPER_PRIME_FEE_BPS;
        } else if (creditScore >= 650) {
            feeBps = PRIME_FEE_BPS;
        }

        uint256 fee = (amount * feeBps) / 10000;

        // Transfer funds to receiver
        token.safeTransfer(receiver, amount);

        // Execute callback
        require(
            IFlashBorrower(receiver).onFlashLoan(msg.sender, amount, fee, data) == CALLBACK_SUCCESS,
            "FlashLoan: Callback failed"
        );

        // Pull funds back (principal + fee)
        token.safeTransferFrom(receiver, address(this), amount + fee);

        emit FlashLoan(receiver, address(token), amount, fee, creditScore);
    }
}
