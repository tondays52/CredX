// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IFlashBorrower} from "../interfaces/IFlashBorrower.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockFlashBorrower is IFlashBorrower {
    using SafeERC20 for IERC20;

    error ZeroAddress();

    event FlashLoanReceived(address indexed initiator, uint256 amount, uint256 fee);

    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    IERC20 public immutable TOKEN;
    uint256 public lastFeePaid;

    constructor(address _token) {
        if (_token == address(0)) revert ZeroAddress();
        TOKEN = IERC20(_token);
    }

    function onFlashLoan(
        address initiator,
        uint256 amount,
        uint256 fee,
        bytes calldata /* data */
    ) external override returns (bytes32) {
        if (initiator == address(0)) revert ZeroAddress();
        lastFeePaid = fee;

        // Approve the lender to pull the principal + fee
        TOKEN.approve(msg.sender, amount + fee);

        emit FlashLoanReceived(initiator, amount, fee);
        return CALLBACK_SUCCESS;
    }
}
