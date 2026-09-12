// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAttestationVerifier} from "./IAttestationVerifier.sol";

struct EscrowRecord {
    uint256 escrowId;
    address depositor;     // buyer / order owner who locked the funds
    address seller;        // counterparty paid when the attested condition fires
    bytes32 orderRef;      // mutually agreed business reference (PO / invoice / orderId)
    uint256 amountUSD;     // locked settlement amount (18 decimals)
    uint256 deadlineBlock; // escrow expires at this block (fail-closed refund path)
    bool released;         // attested evidence accepted -> funds paid to seller
    bool refunded;         // past deadline without valid proof -> funds returned to depositor
}

/**
 * @title IVerifiedEscrow
 * @notice Condition-locked, proof-gated escrow for credit-adjacent settlements.
 *
 * @dev A depositor locks cUSD against an order. The escrow releases ONLY when a
 *      Cross-chain event proof (USC / Attestcoin-attested Merkle receipt) verifies
 *      against Creditcoin's Attestcoin verifier (native 0x0FD2 BlockProver in
 *      production, mock harness in testnet deployments). The conditions are bound
 *      at creation: exact seller, order reference, amount and deadline. Before the
 *      deadline the funds are unreleasable without a valid proof (fail closed);
 *      after the deadline anyone may trigger the refund back to the depositor.
 *
 *      Replay safety mirrors an Evidence Registry: a single attested receipt keyed
 *      by (sourceChainId, txHash) can release exactly ONE escrow, so the same
 *      cross-chain transaction can never be double-collected.
 */
interface IVerifiedEscrow {
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed depositor,
        address indexed seller,
        bytes32 orderRef,
        uint256 amountUSD,
        uint256 deadlineBlock
    );
    event EscrowReleased(
        uint256 indexed escrowId,
        address indexed seller,
        uint256 amountUSD,
        uint256 sourceChainId,
        bytes32 txHash,
        uint256 sourceBlockTime
    );
    event EscrowRefunded(uint256 indexed escrowId, address indexed depositor, uint256 amountUSD);
    event VerifierUpdated(address previousVerifier, address newVerifier);

    error ZeroAddress();
    error OnlyOwner();
    error InvalidOrderRef();
    error ZeroAmount();
    error DeadlineNotFuture();
    error EscrowNotActive();
    error AlreadyReleased();
    error AlreadyRefunded();
    error NotYetRefundable();
    error ProofRejected();
    error WrongEventSignature();
    error ProofAlreadyUsed();

    /**
     * @notice Lock settlement funds against an order with a hard condition set.
     * @param seller The counterparty that becomes payable on verified evidence.
     * @param orderRef Binding business reference (keccak of PO/invoice/orderId).
     * @param amountUSD Settlement amount locked (18 decimals cUSD).
     * @param deadlineBlock Block after which a proof-less escrow is refundable.
     */
    function createEscrow(address seller, bytes32 orderRef, uint256 amountUSD, uint256 deadlineBlock)
        external
        returns (uint256 escrowId);

    /**
     * @notice Release the escrow to the seller once the attested condition fires.
     * @dev Any caller may submit the public receipt; funds always go to the
     *      committed seller. The proof is pinned to an event type via
     *      `expectedEventSignature` (Topic0; 0 = accept any verified event).
     * @param escrowId Id of the escrow to release.
     * @param evidence Cross-chain receipt proof (event on the source chain).
     * @param expectedEventSignature Optional Topic0 to bind the condition.
     */
    function release(
        uint256 escrowId,
        IAttestationVerifier.EventProof calldata evidence,
        bytes32 expectedEventSignature
    ) external;

    /**
     * @notice Fail-closed expiry: after the deadline, anyone may return the
     *         locked funds to the depositor if no valid proof released the escrow.
     */
    function refundAfterDeadline(uint256 escrowId) external;

    /**
     * @notice Point the verifier at a new instance (e.g. mock harness -> native 0x0FD2 precompile).
     */
    function setVerifier(address newVerifier) external;

    function getEscrow(uint256 escrowId) external view returns (EscrowRecord memory);
    function escrowCount() external view returns (uint256);
    function totalLockedUSD() external view returns (uint256);
}