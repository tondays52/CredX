// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import {ILendingPool, LoanPosition} from "../interfaces/ILendingPool.sol";
import {ICredXHub} from "../interfaces/ICredXHub.sol";
import {CreditScoreEngine} from "./CreditScoreEngine.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

/**
 * @title UndercollateralizedLendingPool
 * @notice Capital pool enabling under-collateralized lending (down to 70% collateral ratio)
 *         and discounted interest rates based on Creditcoin Attestcoin verified reputation.
 */
contract UndercollateralizedLendingPool is ILendingPool {
    MockERC20 public liquidityToken; // e.g. cUSD / USDC
    ICredXHub public credXHub;
    CreditScoreEngine public scoreEngine;
    address public owner;

    uint256 public constant BPS_DIVISOR = 10000;
    uint256 public constant CTC_PRICE_USD = 2 * 10**18; // Simulated 1 CTC = $2.00 USD for demo calculations

    uint256 public nextLoanId = 1;
    uint256 public totalLiquidityUSD;
    uint256 public totalBorrowedUSD;

    mapping(address lender => uint256 balanceUSD) public lenderBalances;
    mapping(uint256 loanId => LoanPosition position) public loans;
    mapping(address borrower => uint256[] ids) public userLoanIds;

    // ═══════════════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════════════
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

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _tokenAddress, address _credXHub, address _scoreEngine) {
        owner = msg.sender;
        liquidityToken = MockERC20(_tokenAddress);
        credXHub = ICredXHub(_credXHub);
        scoreEngine = CreditScoreEngine(_scoreEngine);
    }

    /**
     * @notice Lenders deposit liquidity (cUSD) to earn yield from undercollateralized loans.
     */
    function depositLiquidity(uint256 amountUSD) external override {
        require(amountUSD > 0, "Amount must be > 0");
        require(liquidityToken.transferFrom(msg.sender, address(this), amountUSD), "Transfer failed");

        lenderBalances[msg.sender] += amountUSD;
        totalLiquidityUSD += amountUSD;

        emit LiquidityDeposited(msg.sender, amountUSD);
    }

    /**
     * @notice Lenders withdraw their supplied liquidity.
     */
    function withdrawLiquidity(uint256 amountUSD) external override {
        require(lenderBalances[msg.sender] >= amountUSD, "Insufficient lender balance");
        require(totalLiquidityUSD - totalBorrowedUSD >= amountUSD, "Insufficient pool liquidity");

        lenderBalances[msg.sender] -= amountUSD;
        totalLiquidityUSD -= amountUSD;
        require(liquidityToken.transfer(msg.sender, amountUSD), "Transfer failed");

        emit LiquidityWithdrawn(msg.sender, amountUSD);
    }

    /**
     * @notice Borrow cUSD against CTC collateral with dynamically discounted collateral ratios.
     * @param requestedUSD Amount of cUSD to borrow (18 decimals).
     */
    function borrow(uint256 requestedUSD) external payable override returns (uint256 loanId) {
        require(requestedUSD > 0, "Borrow amount must be > 0");
        require(totalLiquidityUSD - totalBorrowedUSD >= requestedUSD, "Pool has insufficient liquidity");

        // 1. Fetch Borrower Profile and Collateral Requirements from CredXHub
        (
            uint256 creditScore,
            ,
            ,
            uint256 maxCreditLineUSD,
            uint256 requiredCollateralRatioBps,
            
        ) = credXHub.getBorrowerProfile(msg.sender);

        require(requestedUSD <= maxCreditLineUSD, "Exceeds approved max credit line");

        // 2. Calculate Required Collateral in native CTC
        // Required Collateral USD = requestedUSD * (requiredCollateralRatioBps / 10000)
        // Collateral CTC = Required Collateral USD / CTC_PRICE_USD
        uint256 requiredCollateralUSD = (requestedUSD * requiredCollateralRatioBps) / BPS_DIVISOR;
        uint256 requiredCollateralCTC = (requiredCollateralUSD * 10**18) / CTC_PRICE_USD;

        require(msg.value >= requiredCollateralCTC, "Insufficient CTC collateral sent");

        // 3. Compute Interest Rate — Direct FICO-style APR based on credit score
        uint256 finalInterestRateBps = scoreEngine.getInterestRate(creditScore);

        loanId = nextLoanId++;
        uint256 dueDate = block.timestamp + 30 days; // 30-day loan duration

        loans[loanId] = LoanPosition({
            loanId: loanId,
            borrower: msg.sender,
            principalUSD: requestedUSD,
            collateralCTC: msg.value,
            borrowedAtTimestamp: block.timestamp,
            dueTimestamp: dueDate,
            interestRateBps: finalInterestRateBps,
            isRepaid: false,
            isDefaulted: false
        });

        userLoanIds[msg.sender].push(loanId);
        totalBorrowedUSD += requestedUSD;

        // Disburse borrowed liquidity to borrower
        require(liquidityToken.transfer(msg.sender, requestedUSD), "Disbursement transfer failed");

        emit LoanOriginated(
            loanId,
            msg.sender,
            requestedUSD,
            msg.value,
            requiredCollateralRatioBps,
            finalInterestRateBps,
            dueDate
        );

        return loanId;
    }

    /**
     * @notice Repays an active loan and unlocks the locked native CTC collateral.
     */
    function repayLoan(uint256 loanId, uint256 amountUSD) external override {
        LoanPosition storage loan = loans[loanId];
        require(!loan.isRepaid, "Loan already repaid");
        require(!loan.isDefaulted, "Loan is defaulted");
        require(msg.sender == loan.borrower, "Only borrower can repay");

        // Calculate interest: principal * (rate / 10000) * (duration / 365 days)
        uint256 elapsed = block.timestamp - loan.borrowedAtTimestamp;
        uint256 interestUSD = (loan.principalUSD * loan.interestRateBps * elapsed) / (BPS_DIVISOR * 365 days);
        uint256 totalDueUSD = loan.principalUSD + interestUSD;

        require(amountUSD >= totalDueUSD, "Repayment amount is less than total due");

        // Pull repayment tokens
        require(liquidityToken.transferFrom(msg.sender, address(this), totalDueUSD), "Token repayment failed");

        loan.isRepaid = true;
        totalBorrowedUSD -= loan.principalUSD;

        // Return collateral to borrower
        uint256 refundCollateral = loan.collateralCTC;
        loan.collateralCTC = 0;
        (bool sent, ) = payable(msg.sender).call{value: refundCollateral}("");
        require(sent, "Collateral return failed");

        emit LoanRepaid(loanId, msg.sender, totalDueUSD);
    }

    /**
     * @notice Liquidates an overdue loan that was not repaid before dueTimestamp.
     * @param loanId The ID of the loan to liquidate.
     */
    function liquidateDefaultedLoan(uint256 loanId) external {
        LoanPosition storage loan = loans[loanId];
        require(!loan.isRepaid, "Loan already repaid");
        require(!loan.isDefaulted, "Loan is defaulted");
        require(block.timestamp > loan.dueTimestamp, "Loan not overdue");

        loan.isDefaulted = true;
        uint256 liquidatedCollateral = loan.collateralCTC;
        loan.collateralCTC = 0;

        emit LoanDefaulted(loanId, loan.borrower, liquidatedCollateral);
    }

    /**
     * @notice Returns all loan IDs for a specific user.
     */
    function getUserLoans(address user) external view returns (uint256[] memory) {
        return userLoanIds[user];
    }
}
