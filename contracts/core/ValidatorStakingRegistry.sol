// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICredXHub} from "../interfaces/ICredXHub.sol";

/**
 * @title ValidatorStakingRegistry
 * @notice Live on-chain validator registry + staking pool for the CredX DePIN
 *         validator economy. Node operators register real Prime-tier validators
 *         (CTS >= 700 enforced through the on-chain CredXHub) and delegators stake
 *         the DePIN token into each validator's pool.
 *
 * @dev Staking rewards accrue every block (standard rewardPerToken accumulator,
 *      𝗻𝗼 delegation is silent for long — every stake/unstake/claim snapshots the
 *      accumulator). Rewards and validator commissions are CREDX ledger credits
 *      (18 decimals) exactly like the Pulse/Nexus/GeoOrbit/AiCompute registries —
 *      an honest on-chain ledger, not a claim of minting a transferable token.
 *      Unstaking is liquid (DEPIN is returned to the delegator immediately).
 *
 *      Validator index: operator => Pool; id => operator for on-chain directory.
 */
contract ValidatorStakingRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ───────────────────────────────────────────────────────────────────────
    // State
    // ───────────────────────────────────────────────────────────────────────

    address public owner;
    bool public paused;

    ICredXHub public immutable CREDX_HUB;
    IERC20 public immutable STAKE_TOKEN;

    /// @notice Minimum on-chain Creditcoin Trust Score for a validator operator.
    uint256 public minOperatorScore;
    /// @notice Maximum commission a validator may set, in bps (5000 = 50%).
    uint256 public constant MAX_COMMISSION_BPS = 5000;
    /// @notice CREDX reward units per staked token per block (18 decimals scaled).
    uint256 public rewardPerTokenPerBlock;

    uint256 public validatorCount;
    uint256 public totalStaked;
    uint256 public totalRewardUnitsIssued;
    uint256 public totalCommissionClaimed;

    struct Pool {
        uint256 validatorId;
        address operator;
        bytes4 nodeTag;
        uint16 commissionBps;
        uint256 totalStaked;
        uint256 accReward;            // 1e18-scaled reward accumulator (delegator share)
        uint256 accCommission;        // 1e18-scaled commission accumulator (validator cut)
        uint256 commissionDebt;       // validator-side debt into the accumulator
        uint256 commissionPool;       // unclaimed commission units
        uint256 claimedCommission;
        uint256 lastUpdateBlock;
        uint256 registeredAt;
    }

    mapping(address operator => Pool info) public pools;
    mapping(uint256 validatorId => address operator) public validatorOperators;

    /// @notice Per-user per-validator staking & accrual bookkeeping.
    mapping(address user => mapping(address operator => uint256 amount)) public staked;
    mapping(address user => mapping(address operator => uint256 debt)) public rewardDebt;
    mapping(address user => mapping(address operator => uint256 pending)) public rewardsPending;

    /// @notice Total CREDX units a user has claimed across all validators.
    mapping(address user => uint256 units) public claimedUnits;

    // ───────────────────────────────────────────────────────────────────────
    // Events
    // ───────────────────────────────────────────────────────────────────────

    event ValidatorRegistered(
        address indexed operator,
        uint256 indexed validatorId,
        bytes4 nodeTag,
        uint16 commissionBps,
        uint256 registeredAt
    );
    event Staked(address indexed user, address indexed operator, uint256 amount);
    event Unstaked(address indexed user, address indexed operator, uint256 amount);
    event RewardsClaimed(address indexed user, address indexed operator, uint256 amount);
    event CommissionClaimed(address indexed operator, uint256 amount);
    event PauseToggled(bool paused);

    // ───────────────────────────────────────────────────────────────────────
    // Errors + Modifiers
    // ───────────────────────────────────────────────────────────────────────

    error OnlyOwner();
    error Paused();
    error ZeroAddress();
    error ZeroAmount();
    error ZeroNodeTag();
    error AlreadyRegistered();
    error NotRegistered();
    error CommissionBpsTooHigh();
    error OperatorScoreTooLow();
    error InsufficientStake();
    error NothingToClaim();
    error InvalidOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ───────────────────────────────────────────────────────────────────────
    // Constructor
    // ───────────────────────────────────────────────────────────────────────

    constructor(address _credXHub, address _stakeToken, address _owner) {
        if (_credXHub == address(0) || _stakeToken == address(0) || _owner == address(0)) revert ZeroAddress();
        CREDX_HUB = ICredXHub(_credXHub);
        STAKE_TOKEN = IERC20(_stakeToken);
        owner = _owner;
        minOperatorScore = 700;
        // ~0.37%·day base at 12s blocks (visible testnet ledger, tuned by owner).
        rewardPerTokenPerBlock = 2e12;
    }

    // ───────────────────────────────────────────────────────────────────────
    // Owner knobs
    // ───────────────────────────────────────────────────────────────────────

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PauseToggled(p);
    }

    function setRewardPerTokenPerBlock(uint256 v) external onlyOwner {
        rewardPerTokenPerBlock = v;
    }

    function setMinOperatorScore(uint256 v) external onlyOwner {
        minOperatorScore = v;
    }

    // ───────────────────────────────────────────────────────────────────────
    // Internal accrual
    // ───────────────────────────────────────────────────────────────────────

    /// @dev State-changing accrual: advances both accumulators for a pool by the
    ///      blocks elapsed since the last touch, then stamps lastUpdateBlock.
    function _accrue(Pool storage p) internal {
        uint256 dt = block.number - p.lastUpdateBlock;
        if (dt == 0) return;
        uint256 step = dt * rewardPerTokenPerBlock;
        uint256 commissionBps = p.commissionBps;
        if (p.totalStaked > 0) {
            p.accReward += (step * (10000 - commissionBps)) / 10000;
            p.accCommission += (step * commissionBps) / 10000;
        }
        p.lastUpdateBlock = block.number;
    }

    /// @dev Credit a user's earned rewards up to the current accumulator for a pool.
    function _earn(address user, address operator, Pool storage p) internal {
        uint256 amt = staked[user][operator];
        uint256 debt = rewardDebt[user][operator];
        if (amt > 0 && p.accReward > debt) {
            rewardsPending[user][operator] += (amt * (p.accReward - debt)) / 1e18;
        }
        rewardDebt[user][operator] = p.accReward;
    }

    // ───────────────────────────────────────────────────────────────────────
    // Validator registration
    // ───────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a Prime-tier validator node (real CTS >= minOperatorScore gate).
     * @param commissionBps The validator's cut of delegator rewards, in bps (cap 50%).
     */
    function registerValidator(bytes4 nodeTag, uint16 commissionBps) external {
        if (paused) revert Paused();
        if (nodeTag == bytes4(0)) revert ZeroNodeTag();
        if (commissionBps > MAX_COMMISSION_BPS) revert CommissionBpsTooHigh();
        if (pools[msg.sender].operator != address(0)) revert AlreadyRegistered();

        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);
        if (creditScore < minOperatorScore) revert OperatorScoreTooLow();

        uint256 id = validatorCount + 1;
        Pool storage p = pools[msg.sender];
        p.validatorId = id;
        p.operator = msg.sender;
        p.nodeTag = nodeTag;
        p.commissionBps = commissionBps;
        p.lastUpdateBlock = block.number;
        p.registeredAt = block.timestamp;
        validatorOperators[id] = msg.sender;
        validatorCount = id;

        emit ValidatorRegistered(msg.sender, id, nodeTag, commissionBps, block.timestamp);
    }

    // ───────────────────────────────────────────────────────────────────────
    // Staking
    // ───────────────────────────────────────────────────────────────────────

    /**
     * @notice Stake DEPIN into a validator's pool. Rewards start accruing next block.
     */
    function stakeToValidator(address operator, uint256 amount) external nonReentrant {
        if (paused) revert Paused();
        if (operator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        Pool storage p = pools[operator];
        if (p.operator == address(0)) revert NotRegistered();

        _accrue(p);
        _earn(msg.sender, operator, p);

        STAKE_TOKEN.safeTransferFrom(msg.sender, address(this), amount);
        staked[msg.sender][operator] += amount;
        p.totalStaked += amount;
        totalStaked += amount;

        emit Staked(msg.sender, operator, amount);
    }

    /**
     * @notice Liquid unstake: DEPIN is returned immediately, rewards snapshotted.
     */
    function unstakeFromValidator(address operator, uint256 amount) external nonReentrant {
        if (paused) revert Paused();
        if (operator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        Pool storage p = pools[operator];
        if (p.operator == address(0)) revert NotRegistered();

        _accrue(p);
        _earn(msg.sender, operator, p);

        uint256 mine = staked[msg.sender][operator];
        if (mine < amount) revert InsufficientStake();
        staked[msg.sender][operator] = mine - amount;
        p.totalStaked -= amount;
        totalStaked -= amount;

        STAKE_TOKEN.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, operator, amount);
    }

    // ───────────────────────────────────────────────────────────────────────
    // Rewards & commissions
    // ───────────────────────────────────────────────────────────────────────

    /**
     * @notice Claim accrued CREDX reward units from a validator's pool.
     */
    function claimRewards(address operator) external {
        if (paused) revert Paused();
        Pool storage p = pools[operator];
        if (p.operator == address(0)) revert NotRegistered();

        _accrue(p);
        _earn(msg.sender, operator, p);

        uint256 amt = rewardsPending[msg.sender][operator];
        if (amt == 0) revert NothingToClaim();
        rewardsPending[msg.sender][operator] = 0;
        claimedUnits[msg.sender] += amt;
        totalRewardUnitsIssued += amt;

        emit RewardsClaimed(msg.sender, operator, amt);
    }

    /**
     * @notice Validators claim their commission cut accrued on their total pool.
     */
    function claimCommission() external {
        if (paused) revert Paused();
        Pool storage p = pools[msg.sender];
        if (p.operator == address(0)) revert NotRegistered();

        _accrue(p);
        // Credit the validator-side accumulator into the claimable commission pool.
        uint256 earned = (p.totalStaked * (p.accCommission - p.commissionDebt)) / 1e18;
        p.commissionDebt = p.accCommission;
        p.commissionPool += earned;

        uint256 amt = p.commissionPool;
        if (amt == 0) revert NothingToClaim();
        p.commissionPool = 0;
        p.claimedCommission += amt;
        totalCommissionClaimed += amt;

        emit CommissionClaimed(msg.sender, amt);
    }

    // ───────────────────────────────────────────────────────────────────────
    // Views
    // ───────────────────────────────────────────────────────────────────────

    function getPool(address operator) external view returns (Pool memory) {
        return pools[operator];
    }

    /** @dev Reward accrual without state change (blocks since last touch applied). */
    function pendingRewards(address user, address operator) external view returns (uint256) {
        Pool memory p = pools[operator];
        if (p.operator == address(0)) return 0;

        uint256 dt = block.number - p.lastUpdateBlock;
        uint256 step = dt * rewardPerTokenPerBlock;
        uint256 cAcc = p.accReward;
        if (dt != 0 && p.totalStaked != 0) {
            cAcc += (step * (10000 - p.commissionBps)) / 10000;
        }
        uint256 amt = staked[user][operator];
        uint256 total = rewardsPending[user][operator];
        if (amt > 0 && cAcc > rewardDebt[user][operator]) {
            total += (amt * (cAcc - rewardDebt[user][operator])) / 1e18;
        }
        return total;
    }

    /** @dev Validator's unclaimed commission units. */
    function pendingCommission(address operator) external view returns (uint256) {
        Pool storage p = pools[operator];
        if (p.operator == address(0)) return 0;
        uint256 dt = block.number - p.lastUpdateBlock;
        uint256 step = dt * rewardPerTokenPerBlock;
        uint256 cAcc = p.accCommission;
        if (dt != 0 && p.totalStaked != 0) {
            cAcc += (step * p.commissionBps) / 10000;
        }
        uint256 pool = p.commissionPool;
        if (p.totalStaked != 0 && cAcc > p.commissionDebt) {
            pool += (p.totalStaked * (cAcc - p.commissionDebt)) / 1e18;
        }
        return pool;
    }
}