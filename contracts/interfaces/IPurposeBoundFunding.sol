// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAttestationVerifier} from "./IAttestationVerifier.sol";

// ═══════════════════════════════════════════════════════════════════════
//  Purpose-Bound Funding Codes (Kirogi / Remit-to-Own style use constraints)
// ═══════════════════════════════════════════════════════════════════════
enum PurposeCode {
    INVOICE_PURCHASE,        // 0 — settle a trade invoice on the source chain
    EQUIPMENT_FINANCING,     // 1 — finance hardware/equipment acquisition
    INVENTORY_REPLENISHMENT, // 2 — restock inventory for a merchant operation
    PAYROLL,                 // 3 — payroll disbursement to verified employees
    GPU_LEASE,               // 4 — compute/GPU lease settlement
    RESEARCH_DEVELOPMENT     // 5 — R&D / software ecosystem grants
}

struct PurposeRecord {
    uint256 recordId;
    address borrower;
    address allowlistedRecipient;   // the ONLY address that may receive purpose-bound funds
    PurposeCode purposeCode;
    bytes32 covenantHash;           // keccak256 context binding the purpose terms to the record
    uint256 approvedUSD;            // approved credit amount (18 decimals)
    uint256 drawnUSD;               // cumulative disbursed amount (18 decimals)
    uint256 collateralCTC;          // locked native collateral (18 decimals)
    uint256 borrowedAtBlock;
    uint256 dueBlock;
    uint256 interestRateBps;
    bool isFrozen;                  // deadswitch / covenant gate
    bool isSettled;
}

/**
 * @title IPurposeBoundFunding
 * @notice Interface for the CredX Purpose-Bound RWA funding facility.
 * @dev Funds are locked to a declared purpose and, until an attested usage
 *      receipt is verified, can only leave the vault to an allowlisted recipient.
 */
interface IPurposeBoundFunding {
    event LiquidityDeposited(address indexed lender, uint256 amountUSD);
    event LiquidityWithdrawn(address indexed lender, uint256 amountUSD);
    event PurposeFunded(
        uint256 indexed recordId,
        address indexed borrower,
        PurposeCode indexed purposeCode,
        address allowlistedRecipient,
        bytes32 covenantHash,
        uint256 approvedUSD,
        uint256 collateralCTC,
        uint256 dueBlock
    );
    event PurposeDisbursed(uint256 indexed recordId, address indexed recipient, uint256 amountUSD);
    event PurposeUsageAttested(uint256 indexed recordId, bytes32 indexed proofTxHash, uint256 amountUSD);
    event PurposeSettled(uint256 indexed recordId, address indexed borrower, uint256 totalRepaidUSD);
    event PurposeFrozen(uint256 indexed recordId, bytes32 indexed evidenceProofRoot, string reason);
    event PurposeRestored(uint256 indexed recordId);

    error ZeroAddress();
    error OnlyOwner();
    error OnlyBorrower();
    error InvalidAmount();
    error InsufficientPoolLiquidity();
    error RecordNotActive();
    error RecordFrozen();
    error DrawExceedsApproval();
    error RecipientNotAllowlisted();
    error ProofRejected();
    error WrongEventSignature();
    error RepaymentInsufficient();
    error AlreadySettled();

    function depositLiquidity(uint256 amountUSD) external;
    function withdrawLiquidity(uint256 amountUSD) external;
    function fundPurpose(
        PurposeCode purposeCode,
        address allowlistedRecipient,
        bytes32 covenantHash,
        uint256 approvedUSD
    ) external payable returns (uint256 recordId);
    function disburseToRecipient(uint256 recordId, uint256 amountUSD) external;
    function disburseAttestedTranche(
        uint256 recordId,
        uint256 amountUSD,
        IAttestationVerifier.EventProof calldata usageProof,
        bytes32 expectedEventSignature
    ) external;
    function settleRecord(uint256 recordId, uint256 amountUSD) external;
    function freezeForBreach(uint256 recordId, bytes32 evidenceProofRoot, string calldata reason) external;
    function restoreRecord(uint256 recordId) external;
    function getUserRecords(address user) external view returns (uint256[] memory);
    function getRecord(uint256 recordId) external view returns (PurposeRecord memory);
}