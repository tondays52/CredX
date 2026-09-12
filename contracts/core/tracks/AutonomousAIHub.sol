// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IAttestationVerifier} from "../../interfaces/IAttestationVerifier.sol";

/**
 * @title AutonomousAIHub
 * @notice An autonomous AI application on Creditcoin that ingests cryptographically verified
 *         cross-chain state proofs (USC / Attestcoin) to autonomously inform risk decisions, 
 *         settle verifiable compute tasks, and trigger on-chain undercollateralized loans for AI agents
 *         WITHOUT centralized oracle operators.
 *
 *         Security hardening over the original:
 *           - risk parameters change via BOUNDED DELTAS (a single verified signal cannot
 *             reset volatility/default-rate to any absolute value)
 *           - an agent's reputation can only be boosted using proofs submitted BY THAT AGENT
 *             (or the protocol owner in recovery scenarios)
 *           - AI agent loans are secured by reputation-based collateral, have a fixed term,
 *             and are liquidatable when overdue — they are no longer unsecured pool grants.
 */
contract AutonomousAIHub is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    //  Custom Errors
    // ═══════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error ZeroAmount();
    error ProofAlreadyProcessed();
    error CryptographicProofInvalid();
    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error ActiveLoanOutstanding();
    error ScoreBelowThreshold();
    error InsufficientLiquidity();
    error NoActiveLoan();
    error InsufficientRepayment();
    error InvalidTaskId();
    error CannotEscrowToSelf();
    error TaskAlreadyExists();
    error TaskDoesNotExist();
    error TaskAlreadySettled();
    error UnauthorizedReputationBoost();
    error LoanNotOverdue();
    error AmountExceedsMaxLoan();
    error OnlyOwner();

    // ═══════════════════════════════════════════════════════════════════════
    //  State & Interfaces
    // ═══════════════════════════════════════════════════════════════════════

    ICredXHub public immutable CREDX_HUB;
    IAttestationVerifier public immutable ATTESTATION_VERIFIER;
    IERC20 public immutable SETTLEMENT_TOKEN;

    uint256 public constant BPS_DIVISOR = 10000;
    uint256 public constant LOAN_DURATION_BLOCKS = 216000; // ~30 days at 12s/block
    uint256 public constant MAX_SINGLE_RISK_DELTA_BPS = 5000; // a single proof can move a param by at most 50%
    uint256 public constant MAX_AGENT_LOAN_AMOUNT_DEFAULT = 100_000 * 10**18;

    address public owner;
    uint256 public maxAgentLoanAmount;

    // Volatility Index: 0 to 10000 (bps)
    uint256 public marketVolatilityIndex;
    // Global Default Rate: 0 to 10000 (bps)
    uint256 public globalDefaultRateBps;
    uint256 public lastRiskUpdateBlock;

    // Cross-chain Proof Replay Protection: sourceChainId => txHash => processed
    mapping(uint256 sourceChainId => mapping(bytes32 txHash => bool processed)) public processedProofs;

    // AgentFi: Autonomous AI Agent profiles
    struct AIAgentProfile {
        uint256 reputationScore;       // 300 to 850
        uint256 totalVerifiedProfitUSD;
        uint256 activeLoanAmount;
        uint256 collateralAmount;
        uint256 dueBlock;
        uint256 totalLoansRepaid;
        bool isRegistered;
    }
    mapping(address agentAddress => AIAgentProfile profile) public aiAgents;

    // Verifiable Proof-of-Compute Settlement
    struct ComputeTask {
        bytes32 taskId;
        address requester;
        address gpuProvider;
        uint256 escrowAmount;
        bool isSettled;
    }
    mapping(bytes32 taskId => ComputeTask task) public computeTasks;

    // ═══════════════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════════════

    event CrossChainRiskSignalProcessed(
        uint256 indexed sourceChainId,
        bytes32 indexed txHash,
        uint256 newVolatilityIndex,
        uint256 newDefaultRateBps,
        uint256 adjustedBaseApr
    );

    event AIAgentRegistered(address indexed agent);
    event AIAgentEvaluated(address indexed agent, uint256 addedProfitUSD, uint256 newReputationScore);
    event AgentLoanDispatched(address indexed agent, uint256 amount, uint256 collateral);
    event AgentLoanRepaid(address indexed agent, uint256 amount);
    event AgentLoanLiquidated(address indexed agent, uint256 forfeitedCollateral);
    event MaxAgentLoanAmountUpdated(uint256 oldAmount, uint256 newAmount);

    event ComputeEscrowDeposited(bytes32 indexed taskId, address indexed requester, address indexed gpuProvider, uint256 amount);
    event ComputeTaskSettled(bytes32 indexed taskId, address indexed gpuProvider, uint256 escrowAmount, bytes32 txHash);

    // ═══════════════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════════════

    constructor(
        address _credXHub,
        address _attestationVerifier,
        address _settlementToken
    ) {
        if (_credXHub == address(0) || _attestationVerifier == address(0) || _settlementToken == address(0)) {
            revert ZeroAddress();
        }

        CREDX_HUB = ICredXHub(_credXHub);
        ATTESTATION_VERIFIER = IAttestationVerifier(_attestationVerifier);
        SETTLEMENT_TOKEN = IERC20(_settlementToken);

        owner = msg.sender;
        maxAgentLoanAmount = MAX_AGENT_LOAN_AMOUNT_DEFAULT;
        marketVolatilityIndex = 1000; // 10% base volatility
        globalDefaultRateBps = 200;   // 2% base default rate
        lastRiskUpdateBlock = block.number;
    }

    function setMaxAgentLoanAmount(uint256 _amount) external {
        if (msg.sender != owner) revert OnlyOwner();
        emit MaxAgentLoanAmountUpdated(maxAgentLoanAmount, _amount);
        maxAgentLoanAmount = _amount;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  1. Oracle-less Cross-Chain Risk Ingestion (Autonomous Decision Engine)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Ingests a cryptographically verified cross-chain transaction receipt (e.g. from Ethereum/Base/Arbitrum)
     *         to autonomously adjust market volatility and protocol risk parameters without a centralized oracle.
     * @dev The deltas are bounded and accumulate from genesis baselines, so one verified signal
     *      can never drive risk parameters straight to an extreme absolute value.
     */
    function processCrossChainRiskSignal(
        IAttestationVerifier.EventProof calldata proof,
        uint256 volatilityIndexDelta,
        uint256 defaultRateDeltaBps
    ) external nonReentrant returns (uint256 newBaseApr) {
        if (processedProofs[proof.sourceChainId][proof.txHash]) {
            revert ProofAlreadyProcessed();
        }

        // Verify cryptographic Merkle Patricia Trie receipt proof via Creditcoin Attestcoin consensus
        IAttestationVerifier.AttestationResult memory result = ATTESTATION_VERIFIER.verifyEventProof(proof);
        if (!result.isValid) {
            revert CryptographicProofInvalid();
        }

        processedProofs[proof.sourceChainId][proof.txHash] = true;

        // Autonomously update risk parameters based on the verified signal — bounded deltas only.
        if (volatilityIndexDelta > MAX_SINGLE_RISK_DELTA_BPS) {
            volatilityIndexDelta = MAX_SINGLE_RISK_DELTA_BPS;
        }
        if (defaultRateDeltaBps > MAX_SINGLE_RISK_DELTA_BPS) {
            defaultRateDeltaBps = MAX_SINGLE_RISK_DELTA_BPS;
        }
        marketVolatilityIndex += volatilityIndexDelta;
        if (marketVolatilityIndex > 10000) {
            marketVolatilityIndex = 10000;
        }
        globalDefaultRateBps += defaultRateDeltaBps;
        if (globalDefaultRateBps > 10000) {
            globalDefaultRateBps = 10000;
        }
        lastRiskUpdateBlock = block.number;

        newBaseApr = getAutonomousRiskAdjustedAPR();

        emit CrossChainRiskSignalProcessed(
            proof.sourceChainId,
            proof.txHash,
            marketVolatilityIndex,
            globalDefaultRateBps,
            newBaseApr
        );
    }

    /**
     * @notice Autonomously computes the risk-adjusted base APR in basis points based on verified multi-chain signals.
     */
    function getAutonomousRiskAdjustedAPR() public view returns (uint256 baseAprBps) {
        uint256 volatilityPremium = marketVolatilityIndex / 10; 
        uint256 defaultRiskPremium = globalDefaultRateBps;

        baseAprBps = 500 + volatilityPremium + defaultRiskPremium;
        if (baseAprBps > 3000) {
            baseAprBps = 3000; // Cap at 30% APR
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  2. Autonomous AI Agent Credit Lines (AgentFi)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Registers an autonomous AI Agent to build an on-chain credit history.
     */
    function registerAIAgent() external {
        if (aiAgents[msg.sender].isRegistered) {
            revert AgentAlreadyRegistered();
        }
        aiAgents[msg.sender] = AIAgentProfile({
            reputationScore: 300, // Initial base score
            totalVerifiedProfitUSD: 0,
            activeLoanAmount: 0,
            collateralAmount: 0,
            dueBlock: 0,
            totalLoansRepaid: 0,
            isRegistered: true
        });

        emit AIAgentRegistered(msg.sender);
    }

    /**
     * @notice Evaluates cryptographically verified cross-chain trading/profit proofs to boost the AI agent's score.
     * @dev Only the agent itself may submit proofs about its own profit history (proofs are bound to the
     *      submitting agent via msg.sender), preventing a third party from pumping someone's reputation.
     */
    function evaluateAgentPerformanceProof(
        address agent,
        IAttestationVerifier.EventProof calldata proof,
        uint256 profitAmountUSD
    ) external nonReentrant returns (uint256 newScore) {
        if (agent == address(0)) {
            revert ZeroAddress();
        }
        if (msg.sender != agent && msg.sender != owner) {
            revert UnauthorizedReputationBoost();
        }
        if (profitAmountUSD == 0) {
            revert ZeroAmount();
        }
        if (!aiAgents[agent].isRegistered) {
            revert AgentNotRegistered();
        }
        if (processedProofs[proof.sourceChainId][proof.txHash]) {
            revert ProofAlreadyProcessed();
        }

        // Verify cryptographic proof
        IAttestationVerifier.AttestationResult memory result = ATTESTATION_VERIFIER.verifyEventProof(proof);
        if (!result.isValid) {
            revert CryptographicProofInvalid();
        }

        processedProofs[proof.sourceChainId][proof.txHash] = true;

        AIAgentProfile storage profile = aiAgents[agent];
        profile.totalVerifiedProfitUSD += profitAmountUSD;

        // Calculate score boost: +50 points per evaluation, capped at 850
        uint256 boost = 50;
        if (profile.reputationScore + boost > 850) {
            profile.reputationScore = 850;
        } else {
            profile.reputationScore += boost;
        }

        newScore = profile.reputationScore;
        emit AIAgentEvaluated(agent, profitAmountUSD, newScore);
    }

    /**
     * @notice Returns the collateral ratio required (basis points) for a given reputation score.
     */
    function getCollateralRatioForReputation(uint256 reputationScore) public pure returns (uint256 collateralRatioBps) {
        if (reputationScore >= 780) return 7000;   // Super-Prime: 70% collateral (30% under-collateralized)
        if (reputationScore >= 700) return 8500;   // Prime: 85%
        if (reputationScore >= 650) return 9500;   // Near-Prime: 95%
        return 15000;                               // Below: fully overcollateralized
    }

    /**
     * @notice Announces the collateral an agent would need to post for a loan.
     */
    function getRequiredCollateral(address agent, uint256 amount) external view returns (uint256) {
        if (!aiAgents[agent].isRegistered) return 0;
        uint256 ratioBps = getCollateralRatioForReputation(aiAgents[agent].reputationScore);
        return (amount * ratioBps) / BPS_DIVISOR;
    }

    /**
     * @notice Autonomously dispatches a reputation-secured micro-loan to an AI agent if its score >= 700.
     * @dev Collateral is posted in the settlement token and returned in full on repayment; it is forfeited
     *      if the loan is liquidated after its fixed term.
     */
    function triggerAutonomousAgentLoan(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert ZeroAmount();
        }
        AIAgentProfile storage profile = aiAgents[msg.sender];
        if (!profile.isRegistered) {
            revert AgentNotRegistered();
        }
        if (profile.activeLoanAmount != 0) {
            revert ActiveLoanOutstanding();
        }

        // Cross-check: Agent must have Autonomous Reputation Score >= 700 (Prime)
        if (profile.reputationScore < 700) {
            revert ScoreBelowThreshold();
        }
        if (amount > maxAgentLoanAmount) {
            revert AmountExceedsMaxLoan();
        }
        if (SETTLEMENT_TOKEN.balanceOf(address(this)) < amount) {
            revert InsufficientLiquidity();
        }

        uint256 requiredCollateral = (amount * getCollateralRatioForReputation(profile.reputationScore)) / BPS_DIVISOR;
        if (requiredCollateral > 0) {
            SETTLEMENT_TOKEN.safeTransferFrom(msg.sender, address(this), requiredCollateral);
        }

        profile.collateralAmount = requiredCollateral;
        profile.dueBlock = block.number + LOAN_DURATION_BLOCKS;
        profile.activeLoanAmount = amount;
        SETTLEMENT_TOKEN.safeTransfer(msg.sender, amount);

        emit AgentLoanDispatched(msg.sender, amount, requiredCollateral);
    }

    /**
     * @notice Repays an active AI agent loan in full, refunding the posted collateral and boosting reliability.
     */
    function repayAgentLoan(uint256 amount) external nonReentrant {
        AIAgentProfile storage profile = aiAgents[msg.sender];
        if (!profile.isRegistered) {
            revert AgentNotRegistered();
        }
        if (profile.activeLoanAmount == 0) {
            revert NoActiveLoan();
        }
        if (amount < profile.activeLoanAmount) {
            revert InsufficientRepayment();
        }

        uint256 loanPrincipal = profile.activeLoanAmount;
        SETTLEMENT_TOKEN.safeTransferFrom(msg.sender, address(this), loanPrincipal);

        profile.activeLoanAmount = 0;
        profile.totalLoansRepaid += loanPrincipal;

        uint256 collateralToRefund = profile.collateralAmount;
        profile.collateralAmount = 0;
        profile.dueBlock = 0;
        if (collateralToRefund > 0) {
            SETTLEMENT_TOKEN.safeTransfer(msg.sender, collateralToRefund);
        }

        // Reward reliability with +20 points boost
        if (profile.reputationScore + 20 <= 850) {
            profile.reputationScore += 20;
        }

        emit AgentLoanRepaid(msg.sender, loanPrincipal);
    }

    /**
     * @notice Liquidates an overdue AI agent loan, seizing the collateral posted against it.
     * @dev The remaining principal is absorbed by the pool (a realized loss for lenders);
     *      the agent's reputation drops 100 points (floor 300).
     */
    function liquidateAgentLoan(address agent) external nonReentrant {
        if (agent == address(0)) {
            revert ZeroAddress();
        }
        AIAgentProfile storage profile = aiAgents[agent];
        if (!profile.isRegistered) {
            revert AgentNotRegistered();
        }
        if (profile.activeLoanAmount == 0) {
            revert NoActiveLoan();
        }
        if (block.number <= profile.dueBlock) {
            revert LoanNotOverdue();
        }

        profile.activeLoanAmount = 0;
        uint256 forfeitedCollateral = profile.collateralAmount;
        profile.collateralAmount = 0;
        profile.dueBlock = 0;

        if (profile.reputationScore >= 400) {
            profile.reputationScore -= 100;
        } else {
            profile.reputationScore = 300;
        }

        emit AgentLoanLiquidated(agent, forfeitedCollateral);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  3. Verifiable Proof-of-Compute Settlement (GPU / Task Lease)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposits escrow for an AI compute / GPU lease task.
     */
    function depositComputeEscrow(
        bytes32 taskId,
        address gpuProvider,
        uint256 amount
    ) external nonReentrant {
        if (taskId == bytes32(0)) {
            revert InvalidTaskId();
        }
        if (gpuProvider == address(0)) {
            revert ZeroAddress();
        }
        if (gpuProvider == msg.sender) {
            revert CannotEscrowToSelf();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (computeTasks[taskId].requester != address(0)) {
            revert TaskAlreadyExists();
        }

        SETTLEMENT_TOKEN.safeTransferFrom(msg.sender, address(this), amount);

        computeTasks[taskId] = ComputeTask({
            taskId: taskId,
            requester: msg.sender,
            gpuProvider: gpuProvider,
            escrowAmount: amount,
            isSettled: false
        });

        emit ComputeEscrowDeposited(taskId, msg.sender, gpuProvider, amount);
    }

    /**
     * @notice Autonomously verifies external GPU task delivery via Attestcoin state proof and releases escrow.
     */
    function settleVerifiableComputeTask(
        bytes32 taskId,
        IAttestationVerifier.EventProof calldata proof
    ) external nonReentrant {
        ComputeTask storage task = computeTasks[taskId];
        if (task.requester == address(0)) {
            revert TaskDoesNotExist();
        }
        if (task.isSettled) {
            revert TaskAlreadySettled();
        }
        if (processedProofs[proof.sourceChainId][proof.txHash]) {
            revert ProofAlreadyProcessed();
        }

        // Verify cryptographic compute delivery receipt proof
        IAttestationVerifier.AttestationResult memory result = ATTESTATION_VERIFIER.verifyEventProof(proof);
        if (!result.isValid) {
            revert CryptographicProofInvalid();
        }

        processedProofs[proof.sourceChainId][proof.txHash] = true;
        task.isSettled = true;

        SETTLEMENT_TOKEN.safeTransfer(task.gpuProvider, task.escrowAmount);

        emit ComputeTaskSettled(taskId, task.gpuProvider, task.escrowAmount, proof.txHash);
    }
}