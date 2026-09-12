// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAttestationVerifier} from "./IAttestationVerifier.sol";

struct ActionMeter {
    bool exists;
    uint256 windowCapUnits;           // max units per window (0 = uncapped)
    uint256 usedUnitsThisWindow;      // consumed units in the current window
    uint256 windowStartBlock;         // block the current window started
    uint256 windowDurationBlocks;     // window length in blocks (0 = no rollover)
    uint256 unitPriceUSD;             // settle price per unit (18 decimals)
    uint256 outstandingDebtUSD;       // unpaid metered usage (18 decimals)
}

/**
 * @title IUsageMeteringRegistry
 * @notice On-chain meter for accountable, metered usage of credit products
 *         (Farebox / ProofPay-style). Every usage increment is either bound to
 *         an attested cross-chain receipt or reported by a registered KYC agent;
 *         caps fail closed, and accrued debt is on-chain and payable.
 */
interface IUsageMeteringRegistry {
    event MeterSet(address indexed user, bytes32 indexed actionKey, uint256 windowCapUnits, uint256 windowDurationBlocks, uint256 unitPriceUSD);
    event MeterRemoved(address indexed user, bytes32 indexed actionKey);
    event UsageRecorded(address indexed user, bytes32 indexed actionKey, uint256 units, uint256 sourceTimestamp);
    event DebtSettled(address indexed user, bytes32 indexed actionKey, uint256 amountUSD);
    event KycAgentUpdated(address indexed agent, bool isAgent);

    error ZeroAddress();
    error OnlyOwner();
    error OnlyKycAgent();
    error MeterNotSet();
    error MeterAlreadySet();
    error ExceedsWindowCap();
    error ProofRejected();
    error WrongEventSignature();
    error InvalidUnits();

    function setMeter(
        address user,
        bytes32 actionKey,
        uint256 windowCapUnits,
        uint256 windowDurationBlocks,
        uint256 unitPriceUSD
    ) external;
    function removeMeter(address user, bytes32 actionKey) external;
    function setKycAgent(address agent, bool isAgent) external;
    function recordAttestedUsage(
        address user,
        bytes32 actionKey,
        uint256 units,
        IAttestationVerifier.EventProof calldata usageProof,
        bytes32 expectedEventSignature
    ) external;
    function reportTelemetryUsage(address user, bytes32 actionKey, uint256 units) external;
    function settleDebt(address user, bytes32 actionKey, uint256 maxPayUSD) external returns (uint256 amountPaidUSD);
    function getMeterReading(address user, bytes32 actionKey) external view returns (ActionMeter memory);
    function getTotalOutstandingDebt(address user) external view returns (uint256);
}