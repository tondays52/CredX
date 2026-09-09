// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ReputationYieldVault
 * @notice A staking vault where yield farming rewards are multiplied based on cross-chain credit score.
 */
contract ReputationYieldVault {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error NoRewards();

    ICredXHub public immutable CREDX_HUB;
    IERC20 public immutable STAKING_TOKEN;
    IERC20 public immutable REWARD_TOKEN;

    // A simplified reward rate for demonstration (e.g., 100 reward tokens per block per staker share)
    uint256 public constant BASE_REWARD_RATE = 100;

    struct StakerInfo {
        uint256 balance;
        uint256 lastUpdateBlock;
        uint256 accumulatedRewards;
    }

    mapping(address user => StakerInfo info) public stakers;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 reward, uint256 appliedMultiplier);

    constructor(address _credXHub, address _stakingToken, address _rewardToken) {
        if (_credXHub == address(0) || _stakingToken == address(0) || _rewardToken == address(0)) {
            revert ZeroAddress();
        }
        CREDX_HUB = ICredXHub(_credXHub);
        STAKING_TOKEN = IERC20(_stakingToken);
        REWARD_TOKEN = IERC20(_rewardToken);
    }

    function _updateRewards(address user) internal {
        StakerInfo storage info = stakers[user];
        if (info.balance > 0 && info.lastUpdateBlock < block.number) {
            uint256 blocks = block.number - info.lastUpdateBlock;
            
            // Get user's current score to calculate multiplier dynamically
            (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(user);
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
        if (amount == 0) revert InvalidAmount();
        _updateRewards(msg.sender);
        
        STAKING_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        stakers[msg.sender].balance += amount;
        
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        if (stakers[msg.sender].balance < amount) revert InsufficientBalance();
        
        _updateRewards(msg.sender);
        
        stakers[msg.sender].balance -= amount;
        STAKING_TOKEN.safeTransfer(msg.sender, amount);
        
        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external {
        _updateRewards(msg.sender);
        
        uint256 reward = stakers[msg.sender].accumulatedRewards;
        if (reward == 0) revert NoRewards();
        
        stakers[msg.sender].accumulatedRewards = 0;
        
        // In a real scenario, this would mint or transfer from a reserve
        // We simulate by just transferring (requires vault to be funded with rewardTokens)
        REWARD_TOKEN.safeTransfer(msg.sender, reward);
        
        // Log the multiplier for transparency based on current score
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);
        uint256 multiplier = creditScore >= 780 ? 20 : (creditScore >= 650 ? 15 : 10);
        
        emit RewardsClaimed(msg.sender, reward, multiplier);
    }
}
