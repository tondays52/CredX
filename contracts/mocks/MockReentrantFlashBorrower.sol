// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IFlashBorrower} from "../interfaces/IFlashBorrower.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockReentrantFlashBorrower
 * @notice TEST-ONLY. Attempts to take a second flash loan from inside the flash loan
 *         callback to verify that the lender's reentrancy guard blocks it.
 */
contract MockReentrantFlashBorrower is IFlashBorrower {
    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    IERC20 public immutable TOKEN;
    address public lender;
    bool public reentrancyAttemptBlocked;

    error ZeroAddress();

    constructor(address _token) {
        if (_token == address(0)) revert ZeroAddress();
        TOKEN = IERC20(_token);
    }

    function configure(address _lender) external {
        lender = _lender;
    }

    function onFlashLoan(
        address /* initiator */,
        uint256 amount,
        uint256 fee,
        bytes calldata /* data */
    ) external override returns (bytes32) {
        TOKEN.approve(msg.sender, amount + fee);

        if (lender != address(0)) {
            bytes4 selector = bytes4(keccak256("flashLoan(address,uint256,bytes)"));
            (bool ok, ) = lender.call(abi.encodeWithSelector(selector, address(this), amount, "0x"));
            reentrancyAttemptBlocked = !ok;
        }

        return CALLBACK_SUCCESS;
    }
}