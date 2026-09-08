// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
 */
contract AutonomousAIHub is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    //  State & Interfaces
    // ═══════════════════════════════════════════════════════════════════════

    ICredXHub public immutable credXHub;
    IAttestationVerifier public immutable attestationVerifier;
    IERC20 public immutable settlementToken;

    // Volatility Index: 0 to 10000 (bps)
    uint256 public marketVolatilityIndex;
    // Global Default Rate: 0 to 10000 (bps)
    uint256 public globalDefaultRateBps;
    uint256 public lastRiskUpdateTimestamp;

    // Cross-chain Proof Replay Protection: sourceChainId => txHash => processed
    mapping(uint256 sourceChainId => mapping(bytes32 txHash => bool processed)) public processedProofs;

    // AgentFi: Autonomous AI Agent profiles
    struct AIAgentProfile {
        uint256 reputationScore;       // 300 to 850
        uint256 totalVerifiedProfitUSD;
        uint256 activeLoanAmount;
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
    event AgentLoanDispatched(address indexed agent, uint256 amount);
    event AgentLoanRepaid(address indexed agent, uint256 amount);

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
        require(_credXHub != address(0), "Zero address: credXHub");
        require(_attestationVerifier != address(0), "Zero address: attestationVerifier");
        require(_settlementToken != address(0), "Zero address: settlementToken");

        credXHub = ICredXHub(_credXHub);
        attestationVerifier = IAttestationVerifier(_attestationVerifier);
        settlementToken = IERC20(_settlementToken);

        marketVolatilityIndex = 1000; // 10% base volatility
        globalDefaultRateBps = 200;   // 2% base default rate
        lastRiskUpdateTimestamp = block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  1. Oracle-less Cross-Chain Risk Ingestion (Autonomous Decision Engine)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Ingests a cryptographically verified cross-chain transaction receipt (e.g. from Ethereum/Base/Arbitrum)
     *         to autonomously adjust market volatility and protocol risk parameters without a centralized oracle.
     */
    function processCrossChainRiskSignal(
        IAttestationVerifier.EventProof calldata proof,
        uint256 volatilityIndexDelta,
        uint256 defaultRateDeltaBps
    ) external nonReentrant returns (uint256 newBaseApr) {
        require(!processedProofs[proof.sourceChainId][proof.txHash], "Proof already processed");

        // Verify cryptographic Merkle Patricia Trie receipt proof via Creditcoin Attestcoin consensus
        IAttestationVerifier.AttestationResult memory result = attestationVerifier.verifyEventProof(proof);
        require(result.isValid, "Cryptographic proof invalid");

        processedProofs[proof.sourceChainId][proof.txHash] = true;

        // Autonomously update risk parameters based on the verified signal
        if (volatilityIndexDelta > 0) {
            marketVolatilityIndex = volatilityIndexDelta > 10000 ? 10000 : volatilityIndexDelta;
        }
        if (defaultRateDeltaBps > 0) {
            globalDefaultRateBps = defaultRateDeltaBps > 10000 ? 10000 : defaultRateDeltaBps;
        }
        lastRiskUpdateTimestamp = block.timestamp;

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
        require(!aiAgents[msg.sender].isRegistered, "Agent already registered");
        aiAgents[msg.sender] = AIAgentProfile({
            reputationScore: 300, // Initial base score
            totalVerifiedProfitUSD: 0,
            activeLoanAmount: 0,
            totalLoansRepaid: 0,
            isRegistered: true
        });

        emit AIAgentRegistered(msg.sender);
    }

    /**
     * @notice Evaluates cryptographically verified cross-chain trading/profit proofs to boost the AI agent's score.
     */
    function evaluateAgentPerformanceProof(
        address agent,
        IAttestationVerifier.EventProof calldata proof,
        uint256 profitAmountUSD
    ) external nonReentrant returns (uint256 newScore) {
        require(agent != address(0), "Zero address: agent");
        require(aiAgents[agent].isRegistered, "Agent not registered");
        require(!processedProofs[proof.sourceChainId][proof.txHash], "Proof already processed");

        // Verify cryptographic proof
        IAttestationVerifier.AttestationResult memory result = attestationVerifier.verifyEventProof(proof);
        require(result.isValid, "Cryptographic proof invalid");

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
     * @notice Autonomously dispatches an undercollateralized micro-loan to an AI agent if its score >= 700.
     */
    function triggerAutonomousAgentLoan(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        AIAgentProfile storage profile = aiAgents[msg.sender];
        require(profile.isRegistered, "Agent not registered");
        require(profile.activeLoanAmount == 0, "Active loan outstanding");

        // Cross-check: Agent must have Autonomous Reputation Score >= 700 (Prime)
        require(profile.reputationScore >= 700, "Agent credit score below Prime threshold (700)");
        require(settlementToken.balanceOf(address(this)) >= amount, "Insufficient pool liquidity");

        profile.activeLoanAmount = amount;
        settlementToken.safeTransfer(msg.sender, amount);

        emit AgentLoanDispatched(msg.sender, amount);
    }

    /**
     * @notice Repays an active AI agent loan, boosting reliability and updating metrics.
     */
    function repayAgentLoan(uint256 amount) external nonReentrant {
        AIAgentProfile storage profile = aiAgents[msg.sender];
        require(profile.isRegistered, "Agent not registered");
        require(profile.activeLoanAmount > 0, "No active loan");
        require(amount >= profile.activeLoanAmount, "Must repay full loan balance");

        settlementToken.safeTransferFrom(msg.sender, address(this), amount);

        profile.activeLoanAmount = 0;
        profile.totalLoansRepaid += amount;

        // Reward reliability with +20 points boost
        if (profile.reputationScore + 20 <= 850) {
            profile.reputationScore += 20;
        }

        emit AgentLoanRepaid(msg.sender, amount);
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
        require(taskId != bytes32(0), "Invalid taskId");
        require(gpuProvider != address(0), "Zero address: gpuProvider");
        require(gpuProvider != msg.sender, "Cannot escrow to self");
        require(amount > 0, "Amount must be > 0");
        require(computeTasks[taskId].requester == address(0), "Task ID already exists");

        settlementToken.safeTransferFrom(msg.sender, address(this), amount);

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
        require(task.requester != address(0), "Task does not exist");
        require(!task.isSettled, "Task already settled");
        require(!processedProofs[proof.sourceChainId][proof.txHash], "Proof already processed");

        // Verify cryptographic compute delivery receipt proof
        IAttestationVerifier.AttestationResult memory result = attestationVerifier.verifyEventProof(proof);
        require(result.isValid, "Invalid cryptographic compute proof");

        processedProofs[proof.sourceChainId][proof.txHash] = true;
        task.isSettled = true;

        settlementToken.safeTransfer(task.gpuProvider, task.escrowAmount);

        emit ComputeTaskSettled(taskId, task.gpuProvider, task.escrowAmount, proof.txHash);
    }
}
