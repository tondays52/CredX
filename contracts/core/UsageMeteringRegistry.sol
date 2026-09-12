// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IUsageMeteringRegistry, ActionMeter} from "../interfaces/IUsageMeteringRegistry.sol";
import {ICredXHub} from "../interfaces/ICredXHub.sol";
import {IAttestationVerifier} from "../interfaces/IAttestationVerifier.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UsageMeteringRegistry
 * @notice Metered, accountable usage ledger for credit products
 *         (Farebox / ProofPay-style).
 * @dev Every usage increment is settled against a meter:
 *        - USB-attested path: `recordAttestedUsage` binds the increment to a
 *          Merkle/continuity receipt verified through the Attestcoin verifier
 *          (mock harness today, 0x0FD2 BlockProver precompile in production).
 *        - Telemetry path: `reportTelemetryUsage` accepts off-chain metered
 *          usage (DePIN bandwidth, GPU seconds, perps ticks) from registered
 *          KYC agents.
 *      Caps fail closed (ExceedsWindowCap); accrued debt is on-chain and
 *      payable in the settlement token.
 */
contract UsageMeteringRegistry is IUsageMeteringRegistry, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public settlementToken;
    IAttestationVerifier public verifier;
    ICredXHub public credXHub;
    address public owner;

    mapping(address user => mapping(bytes32 actionKey => ActionMeter meter)) public meters;
    mapping(address user => uint256 debtUSD) public totalOutstandingDebt;
    mapping(address agent => bool isAgent) public kycAgents;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyKycAgentOrOwner() {
        if (msg.sender != owner && !kycAgents[msg.sender]) revert OnlyKycAgent();
        _;
    }

    constructor(address _tokenAddress, address _verifier, address _credXHub) {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (_verifier == address(0)) revert ZeroAddress();
        if (_credXHub == address(0)) revert ZeroAddress();
        owner = msg.sender;
        settlementToken = IERC20(_tokenAddress);
        verifier = IAttestationVerifier(_verifier);
        credXHub = ICredXHub(_credXHub);
    }

    /**
     * @notice Create (or reconfigure) a meter for a user + action key.
     * @param windowCapUnits Max units per window (0 = uncapped).
     * @param windowDurationBlocks Window length in blocks (0 = never rolls over).
     * @param unitPriceUSD Settle price per unit (18 decimals USD).
     */
    function setMeter(
        address user,
        bytes32 actionKey,
        uint256 windowCapUnits,
        uint256 windowDurationBlocks,
        uint256 unitPriceUSD
    ) external override onlyOwner {
        if (user == address(0)) revert ZeroAddress();
        ActionMeter storage m = meters[user][actionKey];
        m.exists = true;
        m.windowCapUnits = windowCapUnits;
        m.windowDurationBlocks = windowDurationBlocks;
        m.unitPriceUSD = unitPriceUSD;
        if (m.windowStartBlock == 0) {
            m.windowStartBlock = block.number;
        }
        emit MeterSet(user, actionKey, windowCapUnits, windowDurationBlocks, unitPriceUSD);
    }

    function removeMeter(address user, bytes32 actionKey) external override onlyOwner {
        if (!meters[user][actionKey].exists) revert MeterNotSet();
        delete meters[user][actionKey];
        emit MeterRemoved(user, actionKey);
    }

    function setKycAgent(address agent, bool _isAgent) external override onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        kycAgents[agent] = _isAgent;
        emit KycAgentUpdated(agent, _isAgent);
    }

    /**
     * @notice Record usage backed by a verified cross-chain receipt.
     * @dev Any caller may submit the public proof; the meter only advances if
     *      the Attestcoin verifier accepts it (optionally pinned to an event).
     */
    function recordAttestedUsage(
        address user,
        bytes32 actionKey,
        uint256 units,
        IAttestationVerifier.EventProof calldata usageProof,
        bytes32 expectedEventSignature
    ) external override {
        if (user == address(0)) revert ZeroAddress();
        if (units == 0) revert InvalidUnits();
        if (!meters[user][actionKey].exists) revert MeterNotSet();

        IAttestationVerifier.AttestationResult memory result = verifier.verifyEventProof(usageProof);
        if (!result.isValid) revert ProofRejected();
        if (expectedEventSignature != bytes32(0) && result.eventSignature != expectedEventSignature) {
            revert WrongEventSignature();
        }

        _increment(user, actionKey, units);
        emit UsageRecorded(user, actionKey, units, result.sourceBlockTime);
    }

    /**
     * @notice Report metered usage from a registered KYC agent (off-chain
     *         telemetry that cannot carry a Merkle proof).
     */
    function reportTelemetryUsage(address user, bytes32 actionKey, uint256 units) external override onlyKycAgentOrOwner {
        if (user == address(0)) revert ZeroAddress();
        if (units == 0) revert InvalidUnits();
        if (!meters[user][actionKey].exists) revert MeterNotSet();

        _increment(user, actionKey, units);
        emit UsageRecorded(user, actionKey, units, block.timestamp);
    }

    /**
     * @notice Pay down outstanding metered debt with the settlement token.
     * @return amountPaidUSD The amount actually applied.
     */
    function settleDebt(address user, bytes32 actionKey, uint256 maxPayUSD)
        external
        override
        nonReentrant
        returns (uint256 amountPaidUSD)
    {
        ActionMeter storage m = meters[user][actionKey];
        if (!m.exists) revert MeterNotSet();
        if (maxPayUSD == 0) revert InvalidUnits();

        uint256 owed = m.outstandingDebtUSD;
        if (owed == 0) return 0;
        amountPaidUSD = maxPayUSD > owed ? owed : maxPayUSD;

        m.outstandingDebtUSD = owed - amountPaidUSD;
        totalOutstandingDebt[user] -= amountPaidUSD;
        settlementToken.safeTransferFrom(msg.sender, address(this), amountPaidUSD);

        emit DebtSettled(user, actionKey, amountPaidUSD);
    }

    function _increment(address user, bytes32 actionKey, uint256 units) internal {
        ActionMeter storage m = meters[user][actionKey];

        // Window rollover
        if (m.windowDurationBlocks > 0 && block.number >= m.windowStartBlock + m.windowDurationBlocks) {
            m.usedUnitsThisWindow = 0;
            m.windowStartBlock = block.number;
        }

        if (m.windowCapUnits > 0 && m.usedUnitsThisWindow + units > m.windowCapUnits) {
            revert ExceedsWindowCap();
        }

        m.usedUnitsThisWindow += units;

        uint256 debitUSD = (units * m.unitPriceUSD) / 10**18;
        if (debitUSD > 0) {
            m.outstandingDebtUSD += debitUSD;
            totalOutstandingDebt[user] += debitUSD;
        }
    }

    function getMeterReading(address user, bytes32 actionKey) external view override returns (ActionMeter memory) {
        return meters[user][actionKey];
    }

    function getTotalOutstandingDebt(address user) external view override returns (uint256) {
        if (user == address(0)) revert ZeroAddress();
        return totalOutstandingDebt[user];
    }
}