// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IVerifiedEscrow, EscrowRecord} from "../interfaces/IVerifiedEscrow.sol";
import {IAttestationVerifier} from "../interfaces/IAttestationVerifier.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VerifiedEscrow
 * @notice Condition-locked escrow that releases only on a creditcoin-attested
 *         cross-chain proof (VerifiedEscrow / VeriSettle-class settlement vault).
 *
 * @dev Hardening over naive "release on any signature" escrows:
 *      - Conditions are bound at creation (exact seller, order reference, amount,
 *        deadline) and cannot be mutated without a fresh escrow.
 *      - Release requires a valid Attestcoin/USC EventProof through the verifier
 *        (mock harness on testnet; native 0x0FD2 BlockProver precompile in
 *        production). A wrong or crafted event is rejected fail-closed.
 *      - Replay guard: keccak(sourceChainId, txHash) spends at most ONE escrow, so
 *        the same attested receipt cannot collect twice (evidence-registry style).
 *      - Expiry refund can be triggered by anyone after the deadline, so funds
 *        can never be locked forever by an unresponsive depositor.
 */
contract VerifiedEscrow is IVerifiedEscrow, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public settlementToken;
    IAttestationVerifier public verifier;
    address public owner;

    uint256 public nextEscrowId = 1;
    uint256 public override totalLockedUSD;

    mapping(uint256 escrowId => EscrowRecord escrow) public escrows;
    mapping(bytes32 proofKey => bool spent) public usedProofKeys;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _tokenAddress, address _verifier) {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (_verifier == address(0)) revert ZeroAddress();
        owner = msg.sender;
        settlementToken = IERC20(_tokenAddress);
        verifier = IAttestationVerifier(_verifier);
    }

    function setVerifier(address newVerifier) external override onlyOwner {
        if (newVerifier == address(0)) revert ZeroAddress();
        emit VerifierUpdated(address(verifier), newVerifier);
        verifier = IAttestationVerifier(newVerifier);
    }

    function createEscrow(address seller, bytes32 orderRef, uint256 amountUSD, uint256 deadlineBlock)
        external
        override
        nonReentrant
        returns (uint256 escrowId)
    {
        if (seller == address(0)) revert ZeroAddress();
        if (orderRef == bytes32(0)) revert InvalidOrderRef();
        if (amountUSD == 0) revert ZeroAmount();
        if (deadlineBlock <= block.number) revert DeadlineNotFuture();

        escrowId = nextEscrowId++;
        escrows[escrowId] = EscrowRecord({
            escrowId: escrowId,
            depositor: msg.sender,
            seller: seller,
            orderRef: orderRef,
            amountUSD: amountUSD,
            deadlineBlock: deadlineBlock,
            released: false,
            refunded: false
        });
        totalLockedUSD += amountUSD;

        settlementToken.safeTransferFrom(msg.sender, address(this), amountUSD);

        emit EscrowCreated(escrowId, msg.sender, seller, orderRef, amountUSD, deadlineBlock);
    }

    function release(
        uint256 escrowId,
        IAttestationVerifier.EventProof calldata evidence,
        bytes32 expectedEventSignature
    ) external override nonReentrant {
        EscrowRecord storage escrow = escrows[escrowId];
        _ensureActive(escrow);

        // The condition is evaluated against the verifier: the receipt must be a
        // valid attestation, optionally pinned to a specific event Topic0.
        IAttestationVerifier.AttestationResult memory result = verifier.verifyEventProof(evidence);
        if (!result.isValid) revert ProofRejected();
        if (expectedEventSignature != bytes32(0) && result.eventSignature != expectedEventSignature) {
            revert WrongEventSignature();
        }

        // Evidence Registry replay guard: one attested receipt, one escrow.
        bytes32 proofKey = keccak256(abi.encodePacked(evidence.sourceChainId, evidence.txHash));
        if (usedProofKeys[proofKey]) revert ProofAlreadyUsed();
        usedProofKeys[proofKey] = true;

        escrow.released = true;
        totalLockedUSD -= escrow.amountUSD;
        settlementToken.safeTransfer(escrow.seller, escrow.amountUSD);

        emit EscrowReleased(
            escrowId,
            escrow.seller,
            escrow.amountUSD,
            evidence.sourceChainId,
            evidence.txHash,
            result.sourceBlockTime
        );
    }

    function refundAfterDeadline(uint256 escrowId) external override nonReentrant {
        EscrowRecord storage escrow = escrows[escrowId];
        if (escrow.depositor == address(0)) revert EscrowNotActive();
        if (escrow.released) revert AlreadyReleased();
        if (escrow.refunded) revert AlreadyRefunded();
        if (block.number < escrow.deadlineBlock) revert NotYetRefundable();

        escrow.refunded = true;
        totalLockedUSD -= escrow.amountUSD;
        settlementToken.safeTransfer(escrow.depositor, escrow.amountUSD);

        emit EscrowRefunded(escrowId, escrow.depositor, escrow.amountUSD);
    }

    function _ensureActive(EscrowRecord storage escrow) internal view {
        if (escrow.depositor == address(0)) revert EscrowNotActive();
        if (escrow.released) revert AlreadyReleased();
        if (escrow.refunded) revert AlreadyRefunded();
    }

    function getEscrow(uint256 escrowId) external view override returns (EscrowRecord memory) {
        return escrows[escrowId];
    }

    function escrowCount() external view override returns (uint256) {
        return nextEscrowId - 1;
    }
}