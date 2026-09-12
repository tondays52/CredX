// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IAttestationVerifier} from "../interfaces/IAttestationVerifier.sol";

/**
 * @title MockAttestationOracle
 * @notice Test and demo harness simulating Creditcoin's native Attestcoin / USC Proof Verifier.
 * @dev This is a TEST-ONLY simulation. The real protocol must point at the Creditcoin native
 *      precompile (0x0FD2) on Creditcoin networks, never at this harness.
 *
 *      Security hardening over the original:
 *        - cannot be registered as a production verifier inadvertently (address is a mock
 *          on any real deployment's allow-list; deploy.js refuses to use it on live networks)
 *        - `alwaysPass` is now owner-controlled (was settable by anyone)
 *        - `registerAttestation` returns the exact emitter/signature that were recorded,
 *          instead of fabricating a hardcoded USDC emitter for every proof
 */
contract MockAttestationOracle is IAttestationVerifier {
    address public owner;

    struct AttestedRecord {
        bool isAttested;
        address emitterAddress;
        bytes32 eventSignature;
    }

    // Mapping to simulate registered/attested transactions
    mapping(uint256 sourceChainId => mapping(bytes32 txHash => AttestedRecord record)) public attestedTransactions;

    // Configurable simulated results
    bool public alwaysPass = true;

    event ProofAttested(uint256 indexed chainId, bytes32 indexed txHash, address emitter);
    event AlwaysPassUpdated(bool previousStatus, bool newStatus);

    error OnlyOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setAlwaysPass(bool _pass) external onlyOwner {
        emit AlwaysPassUpdated(alwaysPass, _pass);
        alwaysPass = _pass;
    }

    function registerAttestation(uint256 sourceChainId, bytes32 txHash) external {
        attestedTransactions[sourceChainId][txHash] = AttestedRecord({
            isAttested: true,
            emitterAddress: msg.sender,
            eventSignature: keccak256("Repay(address,address,address,uint256,bool)")
        });
        emit ProofAttested(sourceChainId, txHash, msg.sender);
    }

    function verifyEventProof(IAttestationVerifier.EventProof calldata proof) external view override returns (IAttestationVerifier.AttestationResult memory result) {
        AttestedRecord memory record = attestedTransactions[proof.sourceChainId][proof.txHash];

        if (alwaysPass) {
            // Simulation mode: accept any caller-submitted receipt as a "verified cross-chain event".
            // The emitter/signature returned here are the simulation engine's OWN placeholders
            // (address(this) + a generic AttestationVerified signature) — never a fabricated claim
            // about the real source contract that emitted the event.
            return IAttestationVerifier.AttestationResult({
                isValid: true,
                emitterAddress: address(this),
                eventSignature: keccak256("AttestationVerified(uint256,bytes32)"),
                eventData: proof.rlpEncodedReceipt,
                sourceBlockTime: proof.blockNumber > 0 ? 1_700_000_000 + proof.blockNumber : 1_700_000_000
            });
        }

        if (record.isAttested) {
            return IAttestationVerifier.AttestationResult({
                isValid: true,
                emitterAddress: record.emitterAddress,
                eventSignature: record.eventSignature,
                eventData: proof.rlpEncodedReceipt,
                sourceBlockTime: proof.blockNumber > 0 ? 1_700_000_000 + proof.blockNumber : 1_700_000_000
            });
        }

        return IAttestationVerifier.AttestationResult({
            isValid: false,
            emitterAddress: address(0),
            eventSignature: bytes32(0),
            eventData: "",
            sourceBlockTime: 0
        });
    }

    function isTransactionAttested(uint256 sourceChainId, bytes32 txHash) external view override returns (bool) {
        return alwaysPass || attestedTransactions[sourceChainId][txHash].isAttested;
    }
}