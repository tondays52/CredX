// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationYieldVault
 * @notice A staking vault where yield farming rewards are multiplied based on cross-chain credit score.
 *
 *         Uses a global rewardPerToken-style accumulator (as used by Synthetix's StakingRewards),
 *         so rewards are distributed proportionally to each staker's share of the pool and a
 *         staker can never accrue rewards for shares they did not hold. The credit-score
 *         multiplier is applied on top of each user's pro-rata share at harvesting time.
 */
contract ReputationYieldVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error NoRewards();

    ICredXHub public immutable CREDX_HUB;
    IERC20 public immutable STAKING_TOKEN;
    IERC20 public immutable REWARD_TOKEN;

    // A simplified reward rate: reward tokens distributed per block per (full unit of) staked token.
    uint256 public constant REWARD_RATE_PER_BLOCK = 100;
    uint256 public constant PRECISION = 1e18;

    uint256 public totalStaked;
    uint256 public rewardPerTokenStored;
    uint256 public lastRewardBlock;

    mapping(address user => uint256 balance) public stakers;
    mapping(address user => uint256 debt) public rewardDebt;

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
        lastRewardBlock = block.number;
    }

    /**
     * @dev Accrues rewards for the blocks elapsed since the last interaction, based on the
     *      CURRENT totalStaked (i.e. shares that actually were held during those blocks).
     */
    modifier updateRewards() {
        if (block.number > lastRewardBlock && totalStaked > 0) {
            uint256 deltaBlocks = block.number - lastRewardBlock;
            rewardPerTokenStored += (deltaBlocks * REWARD_RATE_PER_BLOCK * PRECISION) / totalStaked;
        }
        lastRewardBlock = block.number;
        _;
    }

    function _getMultiplier(address user) internal view returns (uint256) {
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(user);
        if (creditScore >= 780) {
            return 20; // 2.0x
        } else if (creditScore >= 650) {
            return 15; // 1.5x
        }
        return 10; // 1.0x
    }

    /**
     * @dev Sends the caller any currently claimable rewards and resyncs their reward debt.
     */
    function _harvest(address user) internal {
        uint256 pending = (stakers[user] * (rewardPerTokenStored - rewardDebt[user])) / PRECISION;
        uint256 multiplier = _getMultiplier(user);
        pending = (pending * multiplier) / 10;
        rewardDebt[user] = rewardPerTokenStored;
        if (pending > 0) {
            REWARD_TOKEN.safeTransfer(user, pending);
            emit RewardsClaimed(user, pending, multiplier);
        }
    }

    function stake(uint256 amount) external nonReentrant updateRewards {
        if (amount == 0) revert InvalidAmount();

        _harvest(msg.sender);

        STAKING_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        stakers[msg.sender] += amount;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant updateRewards {
        if (amount == 0) revert InvalidAmount();
        if (stakers[msg.sender] < amount) revert InsufficientBalance();

        _harvest(msg.sender);

        stakers[msg.sender] -= amount;
        totalStaked -= amount;
        STAKING_TOKEN.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount);
    }

    function claimRewards() external nonReentrant updateRewards {
        uint256 reward = (stakers[msg.sender] * (rewardPerTokenStored - rewardDebt[msg.sender])) / PRECISION;
        uint256 multiplier = _getMultiplier(msg.sender);
        reward = (reward * multiplier) / 10;
        rewardDebt[msg.sender] = rewardPerTokenStored;

        if (reward == 0) revert NoRewards();

        REWARD_TOKEN.safeTransfer(msg.sender, reward);
        emit RewardsClaimed(msg.sender, reward, multiplier);
    }
}