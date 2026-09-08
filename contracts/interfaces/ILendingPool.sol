// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILendingPool {
    struct LoanPosition {
        uint256 loanId;
        address borrower;
        uint256 principalUSD;
        uint256 collateralCTC;
        uint256 borrowedAtTimestamp;
        uint256 dueTimestamp;
        uint256 interestRateBps; // Annual percentage rate in basis points (e.g. 500 = 5%)
        bool isRepaid;
        bool isDefaulted;
    }

    event LiquidityDeposited(address indexed lender, uint256 amountUSD);
    event LiquidityWithdrawn(address indexed lender, uint256 amountUSD);
    event LoanOriginated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principalUSD,
        uint256 collateralCTC,
        uint256 collateralRatioBps,
        uint256 interestRateBps,
        uint256 dueTimestamp
    );
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalRepaidUSD);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 collateralLiquidatedCTC);

    function depositLiquidity(uint256 amountUSD) external;
    function withdrawLiquidity(uint256 amountUSD) external;
    function borrow(uint256 requestedUSD) external payable returns (uint256 loanId);
    function repayLoan(uint256 loanId, uint256 amountUSD) external;
}
