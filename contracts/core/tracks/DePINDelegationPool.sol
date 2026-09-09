// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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

    ICredXHub public immutable CREDX_HUB;
    IERC20 public immutable DELEGATION_TOKEN;

    uint256 public constant MIN_SCORE_FOR_DELEGATION = 600;

    mapping(address user => uint256 amount) public userDeposits;
    mapping(address node => uint256 amount) public nodeDelegations;

    // Custom Errors
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientDeposit();
    error NodeScoreTooLow();

    event Deposited(address indexed user, uint256 amount);
    event Delegated(address indexed user, address indexed node, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(address _credXHub, address _delegationToken) {
        if (_credXHub == address(0) || _delegationToken == address(0)) {
            revert ZeroAddress();
        }
        CREDX_HUB = ICredXHub(_credXHub);
        DELEGATION_TOKEN = IERC20(_delegationToken);
    }

    function depositCapital(uint256 amount) external {
        if (amount == 0) {
            revert ZeroAmount();
        }
        DELEGATION_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        userDeposits[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function delegateToNode(address node, uint256 amount) external {
        if (node == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (userDeposits[msg.sender] < amount) {
            revert InsufficientDeposit();
        }

        (uint256 nodeScore, , , , , ) = CREDX_HUB.getBorrowerProfile(node);
        if (nodeScore < MIN_SCORE_FOR_DELEGATION) {
            revert NodeScoreTooLow();
        }

        userDeposits[msg.sender] -= amount;
        nodeDelegations[node] += amount;
        
        // In a real implementation, we would transfer/lock tokens into the node's staking contract
        // DELEGATION_TOKEN.safeTransfer(nodeStakingAddress, amount);

        emit Delegated(msg.sender, node, amount);
    }

    function withdrawCapital(uint256 amount) external {
        if (userDeposits[msg.sender] < amount) {
            revert InsufficientDeposit();
        }
        userDeposits[msg.sender] -= amount;
        DELEGATION_TOKEN.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
}
