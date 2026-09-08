// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title DePINDelegationPool
 * @notice Pool where capital is delegated to hardware nodes based on their verified uptime.
 *         Only nodes with a prime cross-chain score can receive delegations.
 */
contract DePINDelegationPool {
    using SafeERC20 for IERC20;

    ICredXHub public immutable credXHub;
    IERC20 public immutable delegationToken;

    uint256 public constant MIN_SCORE_FOR_DELEGATION = 600;

    mapping(address user => uint256 amount) public userDeposits;
    mapping(address node => uint256 amount) public nodeDelegations;

    event Deposited(address indexed user, uint256 amount);
    event Delegated(address indexed user, address indexed node, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _credXHub, address _delegationToken) {
        require(_credXHub != address(0), "Zero address: credXHub");
        require(_delegationToken != address(0), "Zero address: delegationToken");
        credXHub = ICredXHub(_credXHub);
        delegationToken = IERC20(_delegationToken);
    }

    function depositCapital(uint256 amount) external {
        require(amount > 0, "Must deposit > 0");
        delegationToken.safeTransferFrom(msg.sender, address(this), amount);
        userDeposits[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function delegateToNode(address node, uint256 amount) external {
        require(node != address(0), "Zero address: node");
        require(userDeposits[msg.sender] >= amount, "Insufficient deposit");
        require(amount > 0, "Must delegate > 0");

        (uint256 nodeScore, , , , , ) = credXHub.getBorrowerProfile(node);
        require(nodeScore >= MIN_SCORE_FOR_DELEGATION, "Node score too low");

        userDeposits[msg.sender] -= amount;
        nodeDelegations[node] += amount;
        
        // In a real implementation, we would transfer/lock tokens into the node's staking contract
        // delegationToken.safeTransfer(nodeStakingAddress, amount);

        emit Delegated(msg.sender, node, amount);
    }

    function withdrawCapital(uint256 amount) external {
        require(userDeposits[msg.sender] >= amount, "Insufficient deposit");
        userDeposits[msg.sender] -= amount;
        delegationToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
}
