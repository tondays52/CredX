// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICredXHub} from "../../interfaces/ICredXHub.sol";

/**
 * @title ReputationArena
 * @notice Gamified binary prediction market / paper trading arena.
 *         Allows pre-launch users to forecast crypto price movements (ABOVE / BELOW),
 *         earn Paper Points, build winning streaks, and convert proven predictive accuracy
 *         into an on-chain CredX Creditcoin Trust Score (CTS) boost.
 */
contract ReputationArena is ReentrancyGuard {

    error NotOwner();
    error ZeroAddress();
    error UserAlreadyInitialized();
    error InvalidStrikePrice();
    error InvalidDuration();
    error RoundNotOpen();
    error RoundLocked();
    error InvalidStakeAmount();
    error InsufficientPaperBalance();
    error PredictionAlreadyPlaced();
    error RoundNotFinished();
    error InvalidSettlementPrice();
    error RoundNotSettled();
    error NoPredictionPlaced();
    error PayoutAlreadyClaimed();
    error InsufficientWinStreak();

    enum Choice { ABOVE, BELOW }
    enum RoundStatus { OPEN, CLOSED, SETTLED, CANCELLED }

    struct Prediction {
        Choice choice;
        uint256 stakeAmount;
        bool claimed;
    }

    struct Round {
        uint256 roundId;
        string assetSymbol;      // e.g. "BTC/USD"
        uint256 strikePrice;     // Normalized with 8 decimals (e.g. 7844452000000 = $78,444.52)
        uint256 settlementPrice; // Final price upon resolution
        uint256 startBlock;
        uint256 lockBlock;
        uint256 closeBlock;
        uint256 totalAboveStake;
        uint256 totalBelowStake;
        Choice winningChoice;
        RoundStatus status;
    }

    struct UserStats {
        uint256 paperBalance;
        uint256 currentWinStreak;
        uint256 longestWinStreak;
        uint256 totalWins;
        uint256 totalRounds;
        uint256 totalReputationBoostsClaimed;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  State & Mappings
    // ═══════════════════════════════════════════════════════════════════════

    ICredXHub public immutable CREDX_HUB;
    address public owner;

    uint256 public currentRoundId;
    uint256 public constant INITIAL_PAPER_BALANCE = 10_000 * 1e18; // 10,000 Paper Points
    uint256 public constant STREAK_THRESHOLD = 3;                  // 3 consecutive wins required for boost

    mapping(uint256 roundId => Round roundData) public rounds;
    mapping(uint256 roundId => mapping(address user => Prediction pred)) public userPredictions;
    mapping(address user => UserStats stats) public userStats;

    // ═══════════════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════════════

    event UserRegistered(address indexed user, uint256 initialBalance);
    event RoundCreated(uint256 indexed roundId, string assetSymbol, uint256 strikePrice, uint256 lockBlock, uint256 closeBlock);
    event PredictionPlaced(uint256 indexed roundId, address indexed user, Choice choice, uint256 stakeAmount);
    event RoundSettled(uint256 indexed roundId, uint256 settlementPrice, Choice winningChoice);
    event PayoutClaimed(uint256 indexed roundId, address indexed user, uint256 payoutAmount);
    event ReputationBoostClaimed(address indexed user, uint256 streakCount, uint256 totalBoosts);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _credXHub) {
        if (_credXHub == address(0)) revert ZeroAddress();
        CREDX_HUB = ICredXHub(_credXHub);
        owner = msg.sender;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  User Registration & Onboarding
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Registers a new user for paper trading with initial $10,000 paper points.
     */
    function registerUser() external {
        UserStats storage stats = userStats[msg.sender];
        if (stats.paperBalance != 0 || stats.totalRounds != 0) revert UserAlreadyInitialized();
        
        stats.paperBalance = INITIAL_PAPER_BALANCE;
        emit UserRegistered(msg.sender, INITIAL_PAPER_BALANCE);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Round Management
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Creates a new binary prediction round.
     */
    function createRound(
        string calldata assetSymbol,
        uint256 strikePrice,
        uint256 durationBlocks
    ) external onlyOwner returns (uint256 newRoundId) {
        if (strikePrice == 0) revert InvalidStrikePrice();
        if (durationBlocks < 5) revert InvalidDuration();

        currentRoundId++;
        newRoundId = currentRoundId;

        uint256 startBlock = block.number;
        uint256 lockBlock = startBlock + (durationBlocks / 2);
        uint256 closeBlock = startBlock + durationBlocks;

        rounds[newRoundId] = Round({
            roundId: newRoundId,
            assetSymbol: assetSymbol,
            strikePrice: strikePrice,
            settlementPrice: 0,
            startBlock: startBlock,
            lockBlock: lockBlock,
            closeBlock: closeBlock,
            totalAboveStake: 0,
            totalBelowStake: 0,
            winningChoice: Choice.ABOVE,
            status: RoundStatus.OPEN
        });

        emit RoundCreated(newRoundId, assetSymbol, strikePrice, lockBlock, closeBlock);
    }

    /**
     * @notice Places a paper prediction (ABOVE or BELOW) on an active round.
     */
    function placePrediction(
        uint256 roundId,
        Choice choice,
        uint256 stakeAmount
    ) external nonReentrant {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.OPEN) revert RoundNotOpen();
        if (block.number >= round.lockBlock) revert RoundLocked();
        if (stakeAmount == 0) revert InvalidStakeAmount();

        UserStats storage stats = userStats[msg.sender];
        // Auto-register if new
        if (stats.paperBalance == 0 && stats.totalRounds == 0) {
            stats.paperBalance = INITIAL_PAPER_BALANCE;
            emit UserRegistered(msg.sender, INITIAL_PAPER_BALANCE);
        }

        if (stats.paperBalance < stakeAmount) revert InsufficientPaperBalance();
        Prediction storage userPred = userPredictions[roundId][msg.sender];
        if (userPred.stakeAmount != 0) revert PredictionAlreadyPlaced();

        stats.paperBalance -= stakeAmount;
        stats.totalRounds++;

        userPred.choice = choice;
        userPred.stakeAmount = stakeAmount;
        userPred.claimed = false;

        if (choice == Choice.ABOVE) {
            round.totalAboveStake += stakeAmount;
        } else {
            round.totalBelowStake += stakeAmount;
        }

        emit PredictionPlaced(roundId, msg.sender, choice, stakeAmount);
    }

    /**
     * @notice Settles a round using the verified settlement price (e.g. from Pyth/Oracle).
     */
    function settleRound(uint256 roundId, uint256 settlementPrice) external onlyOwner {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.OPEN) revert RoundNotOpen();
        if (block.number < round.closeBlock) revert RoundNotFinished();
        if (settlementPrice == 0) revert InvalidSettlementPrice();

        round.settlementPrice = settlementPrice;
        round.status = RoundStatus.SETTLED;

        if (settlementPrice >= round.strikePrice) {
            round.winningChoice = Choice.ABOVE;
        } else {
            round.winningChoice = Choice.BELOW;
        }

        emit RoundSettled(roundId, settlementPrice, round.winningChoice);
    }

    /**
     * @notice Claims paper payouts and updates user win streaks.
     */
    function claimPayout(uint256 roundId) external nonReentrant returns (uint256 payout) {
        Round storage round = rounds[roundId];
        if (round.status != RoundStatus.SETTLED) revert RoundNotSettled();

        Prediction storage userPred = userPredictions[roundId][msg.sender];
        if (userPred.stakeAmount == 0) revert NoPredictionPlaced();
        if (userPred.claimed) revert PayoutAlreadyClaimed();

        userPred.claimed = true;
        UserStats storage stats = userStats[msg.sender];

        if (userPred.choice == round.winningChoice) {
            // Winning payout: 2x stake (even money binary option)
            payout = userPred.stakeAmount * 2;
            stats.paperBalance += payout;
            stats.totalWins++;
            stats.currentWinStreak++;

            if (stats.currentWinStreak > stats.longestWinStreak) {
                stats.longestWinStreak = stats.currentWinStreak;
            }
        } else {
            // Lost prediction -> Reset current streak
            payout = 0;
            stats.currentWinStreak = 0;
        }

        emit PayoutClaimed(roundId, msg.sender, payout);
    }

    /**
     * @notice Syncs a verified 3-win streak into on-chain CredX reputation points.
     */
    function syncStreakToReputation() external nonReentrant returns (bool) {
        UserStats storage stats = userStats[msg.sender];
        if (stats.currentWinStreak < STREAK_THRESHOLD) revert InsufficientWinStreak();

        stats.totalReputationBoostsClaimed++;
        // Reset streak counter after claiming to prevent infinite claiming from same streak
        uint256 streakCount = stats.currentWinStreak;
        stats.currentWinStreak = 0;

        emit ReputationBoostClaimed(msg.sender, streakCount, stats.totalReputationBoostsClaimed);
        return true;
    }
}
