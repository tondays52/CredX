// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IAttestationVerifier} from "../interfaces/IAttestationVerifier.sol";

/**
 * @title MockAttestationOracle
 * @notice Test and demo harness simulating Creditcoin's native Attestcoin / USC Proof Verifier.
 * @dev Replicates the behavior of the Creditcoin consensus proof validator for Ethereum and Sepolia.
 */
contract MockAttestationOracle is IAttestationVerifier {
    address public owner;
    
    // Mapping to simulate registered/attested transactions
    mapping(uint256 sourceChainId => mapping(bytes32 txHash => bool isAttested)) public attestedTransactions;
    
    // Configurable simulated results
    bool public alwaysPass = true;

    event ProofAttested(uint256 indexed chainId, bytes32 indexed txHash, address emitter);

    constructor() {
        owner = msg.sender;
    }

    function setAlwaysPass(bool _pass) external {
        alwaysPass = _pass;
    }

    function registerAttestation(uint256 sourceChainId, bytes32 txHash) external {
        attestedTransactions[sourceChainId][txHash] = true;
        emit ProofAttested(sourceChainId, txHash, msg.sender);
    }

    function verifyEventProof(EventProof calldata proof) external view override returns (AttestationResult memory result) {
        if (alwaysPass || attestedTransactions[proof.sourceChainId][proof.txHash]) {
            return AttestationResult({
                isValid: true,
                emitterAddress: address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48), // e.g. USDC / Aave Pool
                eventSignature: keccak256("Repay(address,address,address,uint256,bool)"),
                eventData: proof.rlpEncodedReceipt,
                sourceBlockTime: block.timestamp > 100 ? block.timestamp - 60 : block.timestamp
            });
        }

        return AttestationResult({
            isValid: false,
            emitterAddress: address(0),
            eventSignature: bytes32(0),
            eventData: "",
            sourceBlockTime: 0
        });
    }

    function isTransactionAttested(uint256 sourceChainId, bytes32 txHash) external view override returns (bool) {
        return alwaysPass || attestedTransactions[sourceChainId][txHash];
    }
}
