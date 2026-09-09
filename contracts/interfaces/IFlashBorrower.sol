// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IFlashBorrower {
    function onFlashLoan(
        address initiator,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32);
}
