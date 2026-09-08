// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import {ILendingPool, LoanPosition} from "../interfaces/ILendingPool.sol";
import {ICredXHub} from "../interfaces/ICredXHub.sol";
import {CreditScoreEngine} from "./CreditScoreEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UndercollateralizedLendingPool
 * @notice Capital pool enabling under-collateralized lending (down to 70% collateral ratio)
 *         and discounted interest rates based on Creditcoin Attestcoin verified reputation.
 */
contract UndercollateralizedLendingPool is ILendingPool, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public liquidityToken; // e.g. cUSD / USDC
    ICredXHub public credXHub;
    CreditScoreEngine public scoreEngine;
    address public owner;

    uint256 public constant BPS_DIVISOR = 10000;
    uint256 public constant CTC_PRICE_USD = 2 * 10**18; // Simulated 1 CTC = $2.00 USD for demo calculations
    uint256 public constant LOAN_DURATION_BLOCKS = 216000; // ~30 days at 12s/block
    uint256 public constant BLOCKS_PER_YEAR = 2628000; // ~365 days at 12s/block

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
        uint256 dueBlock
    );
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalRepaidUSD);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 collateralLiquidatedCTC);

    // ═══════════════════════════════════════════════════════════════════════
    //  Custom Errors
    // ═══════════════════════════════════════════════════════════════════════
    error ZeroAddress();
    error OnlyOwner();
    error InvalidAmount();
    error InsufficientLenderBalance();
    error InsufficientPoolLiquidity();
    error ExceedsApprovedCreditLine();
    error InsufficientCollateral();
    error LoanAlreadyRepaid();
    error LoanIsDefaulted();
    error OnlyBorrower();
    error RepaymentAmountInsufficient();
    error CollateralReturnFailed();
    error LoanNotOverdue();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _tokenAddress, address _credXHub, address _scoreEngine) {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (_credXHub == address(0)) revert ZeroAddress();
        if (_scoreEngine == address(0)) revert ZeroAddress();
        owner = msg.sender;
        liquidityToken = IERC20(_tokenAddress);
        credXHub = ICredXHub(_credXHub);
        scoreEngine = CreditScoreEngine(_scoreEngine);
    }

    /**
     * @notice Lenders deposit liquidity (cUSD) to earn yield from undercollateralized loans.
     */
    function depositLiquidity(uint256 amountUSD) external override nonReentrant {
        if (amountUSD == 0) revert InvalidAmount();

        lenderBalances[msg.sender] += amountUSD;
        totalLiquidityUSD += amountUSD;
        liquidityToken.safeTransferFrom(msg.sender, address(this), amountUSD);

        emit LiquidityDeposited(msg.sender, amountUSD);
    }

    /**
     * @notice Lenders withdraw their supplied liquidity.
     */
    function withdrawLiquidity(uint256 amountUSD) external override nonReentrant {
        if (lenderBalances[msg.sender] < amountUSD) revert InsufficientLenderBalance();
        if (totalLiquidityUSD - totalBorrowedUSD < amountUSD) revert InsufficientPoolLiquidity();

        lenderBalances[msg.sender] -= amountUSD;
        totalLiquidityUSD -= amountUSD;
        liquidityToken.safeTransfer(msg.sender, amountUSD);

        emit LiquidityWithdrawn(msg.sender, amountUSD);
    }

    /**
     * @dev Internal helper to validate borrow parameters against borrower profile and compute loan terms.
     */
    function _validateBorrowTerms(
        address borrower,
        uint256 requestedUSD,
        uint256 collateralCTC
    ) internal view returns (uint256 requiredCollateralRatioBps, uint256 finalInterestRateBps) {
        if (borrower == address(0)) revert ZeroAddress();

        (
            uint256 creditScore,
            ,
            ,
            uint256 maxCreditLineUSD,
            uint256 collateralRatioBps,
            
        ) = credXHub.getBorrowerProfile(borrower);

        if (requestedUSD > maxCreditLineUSD) revert ExceedsApprovedCreditLine();

        uint256 requiredCollateralUSD = (requestedUSD * collateralRatioBps) / BPS_DIVISOR;
        uint256 requiredCollateralCTC = (requiredCollateralUSD * 10**18) / CTC_PRICE_USD;

        if (collateralCTC < requiredCollateralCTC) revert InsufficientCollateral();

        uint256 interestRateBps = scoreEngine.getInterestRate(creditScore);
        return (collateralRatioBps, interestRateBps);
    }

    /**
     * @notice Borrow cUSD against CTC collateral with dynamically discounted collateral ratios.
     * @param requestedUSD Amount of cUSD to borrow (18 decimals).
     */
    function borrow(uint256 requestedUSD) external payable override nonReentrant returns (uint256 loanId) {
        if (requestedUSD == 0) revert InvalidAmount();
        if (totalLiquidityUSD - totalBorrowedUSD < requestedUSD) revert InsufficientPoolLiquidity();

        (uint256 requiredCollateralRatioBps, uint256 finalInterestRateBps) = _validateBorrowTerms(
            msg.sender,
            requestedUSD,
            msg.value
        );

        loanId = nextLoanId++;
        uint256 dueBlock = block.number + LOAN_DURATION_BLOCKS; // ~30-day loan duration in blocks

        loans[loanId] = LoanPosition({
            loanId: loanId,
            borrower: msg.sender,
            principalUSD: requestedUSD,
            collateralCTC: msg.value,
            borrowedAtBlock: block.number,
            dueBlock: dueBlock,
            interestRateBps: finalInterestRateBps,
            isRepaid: false,
            isDefaulted: false
        });

        userLoanIds[msg.sender].push(loanId);
        totalBorrowedUSD += requestedUSD;

        // Disburse borrowed liquidity to borrower using SafeERC20
        liquidityToken.safeTransfer(msg.sender, requestedUSD);

        emit LoanOriginated(
            loanId,
            msg.sender,
            requestedUSD,
            msg.value,
            requiredCollateralRatioBps,
            finalInterestRateBps,
            dueBlock
        );

        return loanId;
    }

    /**
     * @notice Repays an active loan and unlocks the locked native CTC collateral.
     */
    function repayLoan(uint256 loanId, uint256 amountUSD) external override nonReentrant {
        LoanPosition storage loan = loans[loanId];
        if (loan.isRepaid) revert LoanAlreadyRepaid();
        if (loan.isDefaulted) revert LoanIsDefaulted();
        if (msg.sender != loan.borrower) revert OnlyBorrower();

        // Calculate interest: principal * (rate / 10000) * (blocksElapsed / BLOCKS_PER_YEAR)
        uint256 blocksElapsed = block.number - loan.borrowedAtBlock;
        uint256 interestUSD = (loan.principalUSD * loan.interestRateBps * blocksElapsed) / (BPS_DIVISOR * BLOCKS_PER_YEAR);
        uint256 totalDueUSD = loan.principalUSD + interestUSD;

        if (amountUSD < totalDueUSD) revert RepaymentAmountInsufficient();

        // Pull repayment tokens using SafeERC20
        liquidityToken.safeTransferFrom(msg.sender, address(this), totalDueUSD);

        loan.isRepaid = true;
        totalBorrowedUSD -= loan.principalUSD;

        // Return collateral to borrower (Checks-Effects-Interactions: state cleared before transfer)
        uint256 refundCollateral = loan.collateralCTC;
        loan.collateralCTC = 0;
        (bool sent, ) = payable(loan.borrower).call{value: refundCollateral}("");
        if (!sent) revert CollateralReturnFailed();

        emit LoanRepaid(loanId, msg.sender, totalDueUSD);
    }

    /**
     * @notice Liquidates an overdue loan that was not repaid before dueBlock.
     * @param loanId The ID of the loan to liquidate.
     */
    function liquidateDefaultedLoan(uint256 loanId) external nonReentrant {
        LoanPosition storage loan = loans[loanId];
        if (loan.isRepaid) revert LoanAlreadyRepaid();
        if (loan.isDefaulted) revert LoanIsDefaulted();
        if (block.number <= loan.dueBlock) revert LoanNotOverdue();

        loan.isDefaulted = true;
        uint256 liquidatedCollateral = loan.collateralCTC;
        loan.collateralCTC = 0;

        emit LoanDefaulted(loanId, loan.borrower, liquidatedCollateral);
    }

    /**
     * @notice Returns all loan IDs for a specific user.
     * @param user The address of the borrower to query.
     */
    function getUserLoans(address user) external view returns (uint256[] memory) {
        if (user == address(0)) revert ZeroAddress();
        return userLoanIds[user];
    }
}
