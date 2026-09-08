// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ReputationYieldVault
 * @notice A staking vault where yield farming rewards are multiplied based on cross-chain credit score.
 */
contract ReputationYieldVault {
    using SafeERC20 for IERC20;

    ICredXHub public immutable credXHub;
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;

    // A simplified reward rate for demonstration (e.g., 100 reward tokens per block per staker share)
    uint256 public constant BASE_REWARD_RATE = 100;

    struct StakerInfo {
        uint256 balance;
        uint256 lastUpdateBlock;
        uint256 accumulatedRewards;
    }

    mapping(address => StakerInfo) public stakers;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 reward, uint256 appliedMultiplier);

    constructor(address _credXHub, address _stakingToken, address _rewardToken) {
        credXHub = ICredXHub(_credXHub);
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    function _updateRewards(address user) internal {
        StakerInfo storage info = stakers[user];
        if (info.balance > 0 && info.lastUpdateBlock < block.number) {
            uint256 blocks = block.number - info.lastUpdateBlock;
            
            // Get user's current score to calculate multiplier dynamically
            (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(user);
            uint256 multiplier = 10; // 1.0x

            if (creditScore >= 780) {
                multiplier = 20; // 2.0x
            } else if (creditScore >= 650) {
                multiplier = 15; // 1.5x
            }

            uint256 rewardForPeriod = (info.balance * blocks * BASE_REWARD_RATE * multiplier) / 10;
            info.accumulatedRewards += rewardForPeriod;
        }
        info.lastUpdateBlock = block.number;
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Cannot stake 0");
        _updateRewards(msg.sender);
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        stakers[msg.sender].balance += amount;
        
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        require(amount > 0, "Cannot unstake 0");
        require(stakers[msg.sender].balance >= amount, "Insufficient balance");
        
        _updateRewards(msg.sender);
        
        stakers[msg.sender].balance -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external {
        _updateRewards(msg.sender);
        
        uint256 reward = stakers[msg.sender].accumulatedRewards;
        require(reward > 0, "No rewards");
        
        stakers[msg.sender].accumulatedRewards = 0;
        
        // In a real scenario, this would mint or transfer from a reserve
        // We simulate by just transferring (requires vault to be funded with rewardTokens)
        rewardToken.safeTransfer(msg.sender, reward);
        
        // Log the multiplier for transparency based on current score
        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        uint256 multiplier = creditScore >= 780 ? 20 : (creditScore >= 650 ? 15 : 10);
        
        emit RewardsClaimed(msg.sender, reward, multiplier);
    }
}
