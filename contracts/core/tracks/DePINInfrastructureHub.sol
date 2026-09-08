// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

    ICredXHub public immutable CREDX_HUB;
    IERC20 public immutable DEPIN_TOKEN;
    
    // Delegation state: user => operator => amount
    mapping(address user => mapping(address operator => uint256 amount)) public delegations;
    
    // Financing state: operator => amount borrowed
    mapping(address operator => uint256 amount) public hardwareLoans;
    
    event StakeDelegated(address indexed user, address indexed operator, uint256 amount);
    event HardwareLoanIssued(address indexed operator, uint256 amount);

    constructor(address _credXHub, address _depinToken) {
        require(_credXHub != address(0), "Zero address: credXHub");
        require(_depinToken != address(0), "Zero address: depinToken");
        CREDX_HUB = ICredXHub(_credXHub);
        DEPIN_TOKEN = IERC20(_depinToken);
    }
    
    // =========================================================================
    // FEATURE 1: Automated Staking Delegation Pool
    // =========================================================================

    /**
     * @notice Delegates capital to a DePIN node operator, strictly enforcing their reliability.
     */
    function delegateStake(address operator, uint256 amount) external nonReentrant {
        require(operator != address(0), "Zero address: operator");
        require(amount > 0, "Amount must be > 0");
        require(operator != msg.sender, "Cannot delegate to self");

        // Fetch operator's profile
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(operator);
        
        // Strict reputation check: Prime operators (Score >= 700) only
        require(creditScore >= 700, "Operator reliability too low");

        // Transfer funds from user to this contract
        DEPIN_TOKEN.safeTransferFrom(msg.sender, address(this), amount);

        // Update state
        delegations[msg.sender][operator] += amount;
        
        emit StakeDelegated(msg.sender, operator, amount);
    }

    // =========================================================================
    // FEATURE 2: Reputation-Based Hardware Financing
    // =========================================================================

    /**
     * @notice Allows top-tier node operators to request an undercollateralized loan to buy more hardware.
     */
    function requestHardwareLoan(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        // Fetch operator's profile
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);
        
        // Strict reputation check: Super-Prime operators (Score >= 750) only
        require(creditScore >= 750, "Insufficient score for uncollateralized hardware loan");
        
        // Ensure pool has enough liquidity
        require(DEPIN_TOKEN.balanceOf(address(this)) >= amount, "Insufficient pool liquidity");

        // Update state
        hardwareLoans[msg.sender] += amount;

        // Transfer the loan
        DEPIN_TOKEN.safeTransfer(msg.sender, amount);

        emit HardwareLoanIssued(msg.sender, amount);
    }
}
