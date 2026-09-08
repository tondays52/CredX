// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IAttestationVerifier.sol";
import "../interfaces/ICredXHub.sol";
import "./CreditScoreEngine.sol";

/**
 * @title CredXHub
 * @notice Central registry for cross-chain proof verification, credit score management,
 *         and Attestcoin / USC integrations on Creditcoin.
 */
contract CredXHub is ICredXHub {
    IAttestationVerifier public attestationVerifier;
    CreditScoreEngine public scoreEngine;
    address public lendingPool;
    address public owner;

    struct BorrowerProfile {
        uint256 creditScore;
        uint256 totalVerifiedVolumeUSD;
        uint256 totalAttestationsCount;
        uint256 lastAttestationTimestamp;
        bool isMainnetActive;
    }

    // Mapping from borrower address => profile data
    mapping(address => BorrowerProfile) public borrowerProfiles;

    // Cryptographic Replay Protection: keccak256(sourceChainId, txHash, logIndex) => bool
    mapping(bytes32 => bool) public processedAttestations;

    // History of verified events per borrower
    mapping(address => VerifiedAttestationRecord[]) private borrowerHistory;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _verifierAddress, address _scoreEngineAddress) {
        owner = msg.sender;
        attestationVerifier = IAttestationVerifier(_verifierAddress);
        scoreEngine = CreditScoreEngine(_scoreEngineAddress);
    }

    function setVerifier(address _newVerifier) external onlyOwner {
        attestationVerifier = IAttestationVerifier(_newVerifier);
    }

    function setScoreEngine(address _newScoreEngine) external onlyOwner {
        scoreEngine = CreditScoreEngine(_newScoreEngine);
    }

    function setLendingPool(address _lendingPool) external onlyOwner {
        lendingPool = _lendingPool;
    }

    /**
     * @notice Submits a transaction receipt & Merkle proof from Ethereum / Sepolia for native verification.
     * @param proof The packaged transaction inclusion & Merkle proof for Attestcoin.
     * @param actionType The category of financial event (e.g. DeFi loan repayment, RWA settlement).
     * @param reportedValueUSD The USD amount (18 decimals) proven in the receipt.
     */
    function submitRepaymentProof(
        IAttestationVerifier.EventProof calldata proof,
        ActionType actionType,
        uint256 reportedValueUSD
    ) external override returns (bool success, uint256 newScore) {
        require(reportedValueUSD > 0, "Value must be > 0");

        // 1. Replay Prevention Key
        bytes32 replayKey = keccak256(abi.encodePacked(proof.sourceChainId, proof.txHash, proof.txIndex));
        require(!processedAttestations[replayKey], "Proof already processed (replay blocked)");

        // 2. Cryptographically Verify Proof with Creditcoin USC / Attestcoin Precompile
        IAttestationVerifier.AttestationResult memory result = attestationVerifier.verifyEventProof(proof);
        require(result.isValid, "Attestcoin verification failed: Invalid cryptographic proof");

        // Mark as processed
        processedAttestations[replayKey] = true;

        // 3. Update Borrower State
        BorrowerProfile storage profile = borrowerProfiles[msg.sender];
        uint256 oldScore = profile.creditScore == 0 ? scoreEngine.MIN_SCORE() : profile.creditScore;

        profile.totalVerifiedVolumeUSD += reportedValueUSD;
        profile.totalAttestationsCount += 1;
        profile.lastAttestationTimestamp = block.timestamp;
        if (proof.sourceChainId == 1) {
            profile.isMainnetActive = true;
        }

        // 4. Calculate Updated CTS Score via CreditScoreEngine
        newScore = scoreEngine.computeScore(
            profile.totalVerifiedVolumeUSD,
            profile.totalAttestationsCount,
            profile.lastAttestationTimestamp,
            profile.isMainnetActive
        );
        profile.creditScore = newScore;

        // 5. Store in history
        borrowerHistory[msg.sender].push(VerifiedAttestationRecord({
            proofHash: replayKey,
            sourceChainId: proof.sourceChainId,
            txHash: proof.txHash,
            borrower: msg.sender,
            actionType: actionType,
            valueUSD: reportedValueUSD,
            sourceTimestamp: result.sourceBlockTime,
            verifiedAt: block.timestamp
        }));

        uint256 maxCreditLineUSD = scoreEngine.getMaxCreditLine(newScore, profile.totalVerifiedVolumeUSD);
        uint256 requiredCollateralRatioBps = scoreEngine.getCollateralRatio(newScore);

        emit ProofSubmittedAndVerified(
            replayKey,
            msg.sender,
            proof.sourceChainId,
            proof.txHash,
            actionType,
            reportedValueUSD,
            newScore
        );

        emit CreditScoreUpdated(
            msg.sender,
            oldScore,
            newScore,
            maxCreditLineUSD,
            requiredCollateralRatioBps
        );

        return (true, newScore);
    }

    /**
     * @notice Returns comprehensive borrower profile including credit line and required collateral ratio.
     */
    function getBorrowerProfile(address borrower) external view override returns (
        uint256 creditScore,
        uint256 totalVerifiedVolumeUSD,
        uint256 totalAttestationsCount,
        uint256 maxCreditLineUSD,
        uint256 requiredCollateralRatioBps,
        uint256 lastAttestationTimestamp
    ) {
        BorrowerProfile memory profile = borrowerProfiles[borrower];
        creditScore = profile.creditScore == 0 ? scoreEngine.MIN_SCORE() : profile.creditScore;
        totalVerifiedVolumeUSD = profile.totalVerifiedVolumeUSD;
        totalAttestationsCount = profile.totalAttestationsCount;
        lastAttestationTimestamp = profile.lastAttestationTimestamp;

        maxCreditLineUSD = scoreEngine.getMaxCreditLine(creditScore, totalVerifiedVolumeUSD);
        requiredCollateralRatioBps = scoreEngine.getCollateralRatio(creditScore);
    }

    /**
     * @notice Retrieves verified attestation history records for a borrower.
     */
    function getBorrowerHistory(address borrower) external view returns (VerifiedAttestationRecord[] memory) {
        return borrowerHistory[borrower];
    }
}
