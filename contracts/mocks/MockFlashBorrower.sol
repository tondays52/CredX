// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockFlashBorrower {
    using SafeERC20 for IERC20;

    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    IERC20 public immutable TOKEN;
    uint256 public lastFeePaid;

    constructor(address _token) {
        require(_token != address(0), "Invalid token");
        TOKEN = IERC20(_token);
    }

    function onFlashLoan(
        address /* initiator */,
        uint256 amount,
        uint256 fee,
        bytes calldata /* data */
    ) external returns (bytes32) {
        lastFeePaid = fee;

        // Approve the lender to pull the principal + fee
        TOKEN.approve(msg.sender, amount + fee);

        return CALLBACK_SUCCESS;
    }
}
