// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

struct LoanPosition {
    uint256 loanId;
    address borrower;
    uint256 principalUSD;
    uint256 collateralCTC;
    uint256 borrowedAtBlock;
    uint256 dueBlock;
    uint256 interestRateBps; // Annual percentage rate in basis points (e.g. 500 = 5%)
    bool isRepaid;
    bool isDefaulted;
}

interface ILendingPool {

    function depositLiquidity(uint256 amountUSD) external;
    function withdrawLiquidity(uint256 amountUSD) external;
    function borrow(uint256 requestedUSD) external payable returns (uint256 loanId);
    function repayLoan(uint256 loanId, uint256 amountUSD) external;
}
