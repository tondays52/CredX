// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICredXHub} from "../../interfaces/ICredXHub.sol";

/**
 * @title DePINInfrastructureHub
 * @notice A unified hub for DePIN networks. Supports Automated Staking Delegation (coordination)
 *         and Undercollateralized Hardware Financing (settlement) based on cross-chain reputation.
 */
contract DePINInfrastructureHub is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Custom Errors
    error ZeroAddress();
    error ZeroAmount();
    error CannotDelegateToSelf();
    error OperatorReliabilityTooLow();
    error InsufficientScoreForLoan();
    error InsufficientLiquidity();
    error NoActiveHardwareLoan();
    error LoanNotOverdue();
    error AmountExceedsMaxLoan();
    error OnlyOwner();

    ICredXHub public immutable CREDX_HUB;
    IERC20 public immutable DEPIN_TOKEN;

    address public owner;
    uint256 public maxHardwareLoanAmount = 100_000 * 10**18;
    uint256 public constant LOAN_DURATION_BLOCKS = 216000; // ~30 days at 12s/block
    
    // Delegation state: user => operator => amount
    mapping(address user => mapping(address operator => uint256 amount)) public delegations;
    
    // Financing state: operator => amount borrowed
    mapping(address operator => uint256 amount) public hardwareLoans;
    // Financing term state: operator => due block
    mapping(address operator => uint256 dueBlock) public hardwareLoanDueBlock;
    
    event StakeDelegated(address indexed user, address indexed operator, uint256 amount);
    event StakeUndelegated(address indexed user, address indexed operator, uint256 amount);
    event HardwareLoanIssued(address indexed operator, uint256 amount);
    event HardwareLoanRepaid(address indexed operator, uint256 amount);
    event HardwareLoanLiquidated(address indexed operator, uint256 amount);
    event MaxHardwareLoanAmountUpdated(uint256 oldAmount, uint256 newAmount);

    constructor(address _credXHub, address _depinToken) {
        if (_credXHub == address(0) || _depinToken == address(0)) {
            revert ZeroAddress();
        }
        CREDX_HUB = ICredXHub(_credXHub);
        DEPIN_TOKEN = IERC20(_depinToken);
        owner = msg.sender;
    }

    function setMaxHardwareLoanAmount(uint256 _amount) external {
        if (msg.sender != owner) revert OnlyOwner();
        emit MaxHardwareLoanAmountUpdated(maxHardwareLoanAmount, _amount);
        maxHardwareLoanAmount = _amount;
    }
    
    // =========================================================================
    // FEATURE 1: Automated Staking Delegation Pool
    // =========================================================================

    /**
     * @notice Delegates capital to a DePIN node operator, strictly enforcing their reliability.
     */
    function delegateStake(address operator, uint256 amount) external nonReentrant {
        if (operator == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (operator == msg.sender) {
            revert CannotDelegateToSelf();
        }

        // Fetch operator's profile
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(operator);
        
        // Strict reputation check: Prime operators (Score >= 700) only
        if (creditScore < 700) {
            revert OperatorReliabilityTooLow();
        }

        // Transfer funds from user to this contract
        DEPIN_TOKEN.safeTransferFrom(msg.sender, address(this), amount);

        // Update state
        delegations[msg.sender][operator] += amount;
        
        emit StakeDelegated(msg.sender, operator, amount);
    }

    /**
     * @notice Undelegates staked capital so delegated tokens are not unrecoverably locked.
     */
    function undelegateStake(address operator, uint256 amount) external nonReentrant {
        if (operator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (delegations[msg.sender][operator] < amount) revert ZeroAmount();

        delegations[msg.sender][operator] -= amount;
        DEPIN_TOKEN.safeTransfer(msg.sender, amount);

        emit StakeUndelegated(msg.sender, operator, amount);
    }

    // =========================================================================
    // FEATURE 2: Reputation-Based Hardware Financing
    // =========================================================================

    /**
     * @notice Allows top-tier node operators to request an undercollateralized loan to buy more hardware.
     * @dev Loans are capped, have a fixed term, and MUST be repaid or the operator is liquidated.
     */
    function requestHardwareLoan(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }
        
        // Fetch operator's profile
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);
        
        // Strict reputation check: Super-Prime operators (Score >= 750) only
        if (creditScore < 750) {
            revert InsufficientScoreForLoan();
        }
        if (hardwareLoans[msg.sender] != 0) {
            revert NoActiveHardwareLoan();
        }
        if (amount > maxHardwareLoanAmount) {
            revert AmountExceedsMaxLoan();
        }
        
        // Ensure pool has enough liquidity
        if (DEPIN_TOKEN.balanceOf(address(this)) < amount) {
            revert InsufficientLiquidity();
        }

        // Update state
        hardwareLoans[msg.sender] = amount;
        hardwareLoanDueBlock[msg.sender] = block.number + LOAN_DURATION_BLOCKS;

        // Transfer the loan
        DEPIN_TOKEN.safeTransfer(msg.sender, amount);

        emit HardwareLoanIssued(msg.sender, amount);
    }

    /**
     * @notice Repays a hardware loan in full, closing the financing line.
     */
    function repayHardwareLoan(uint256 amount) external nonReentrant {
        uint256 loan = hardwareLoans[msg.sender];
        if (loan == 0) revert NoActiveHardwareLoan();
        if (amount < loan) revert ZeroAmount();

        DEPIN_TOKEN.safeTransferFrom(msg.sender, address(this), loan);

        hardwareLoans[msg.sender] = 0;
        hardwareLoanDueBlock[msg.sender] = 0;

        emit HardwareLoanRepaid(msg.sender, loan);
    }

    /**
     * @notice Liquidates an overdue hardware loan. The outstanding balance is written off as a loss.
     */
    function liquidateHardwareLoan(address operator) external nonReentrant {
        if (operator == address(0)) revert ZeroAddress();
        uint256 loan = hardwareLoans[operator];
        if (loan == 0) revert NoActiveHardwareLoan();
        if (block.number <= hardwareLoanDueBlock[operator]) revert LoanNotOverdue();

        hardwareLoans[operator] = 0;
        hardwareLoanDueBlock[operator] = 0;

        emit HardwareLoanLiquidated(operator, loan);
    }
}
