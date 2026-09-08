// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {IAttestationVerifier} from "../interfaces/IAttestationVerifier.sol";
import {ICredXHub, ActionType, VerifiedAttestationRecord} from "../interfaces/ICredXHub.sol";
import {CreditScoreEngine} from "./CreditScoreEngine.sol";

/**
 * @title CredXHub
 * @notice The first cross-chain credit bureau on Creditcoin.
 *         Central registry for multi-protocol proof verification, OCCR credit scoring,
 *         batch proof import, privacy-preserving attestations, and Attestcoin / USC integration.
 * 
 * Key Features:
 *   - Multi-Protocol Reputation Aggregation (Aave, Compound, Uniswap, ENS, RWA)
 *   - Batch Proof Import ("import your entire credit history in 1 click")
 *   - Privacy-Preserving Commitment Hashes
 *   - Protocol & Chain Diversity Tracking
 *   - Credit Score Delegation / Social Lending
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
        uint256 protocolDiversityCount;   // Unique DeFi protocol types used
        uint256 chainDiversityCount;      // Unique source chains attested from
        uint256 weightedActionScore;      // Cumulative weighted action value
    }

    // Track which ActionTypes a borrower has used (bitmap for gas efficiency)
    mapping(address borrower => uint8 actionBitmap) public borrowerActionBitmap;

    // Track which chains a borrower has been attested from (bitmap)
    mapping(address borrower => uint256 chainBitmap) public borrowerChainBitmap;

    // Cryptographic Replay Protection: keccak256(sourceChainId, txHash, logIndex) => bool
    mapping(bytes32 proofHash => bool isProcessed) public processedAttestations;

    // Mapping from borrower address => profile data
    mapping(address borrower => BorrowerProfile profile) public borrowerProfiles;

    // History of verified events per borrower
    mapping(address borrower => VerifiedAttestationRecord[] records) private _borrowerHistory;

    // ═══════════════════════════════════════════════════════════════════════
    //  Credit Delegation (Social Lending / Co-signing)
    // ═══════════════════════════════════════════════════════════════════════
    struct CreditDelegation {
        address delegator;
        uint256 boostAmount;
        uint256 expiry;
        bool isActive;
    }
    mapping(address beneficiary => CreditDelegation delegation) public delegatedBoosts;

    // ═══════════════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════════════
    event ProofSubmittedAndVerified(
        bytes32 indexed proofHash,
        address indexed borrower,
        uint256 sourceChainId,
        bytes32 txHash,
        ActionType actionType,
        uint256 valueUSD,
        uint256 newCreditScore
    );

    event CreditScoreUpdated(
        address indexed borrower,
        uint256 oldScore,
        uint256 newScore,
        uint256 maxCreditLineUSD,
        uint256 requiredCollateralRatioBps
    );

    event BatchProofsSubmitted(
        address indexed borrower,
        uint256 proofsCount,
        uint256 totalValueUSD,
        uint256 finalCreditScore
    );

    event CreditDelegated(
        address indexed delegator,
        address indexed beneficiary,
        uint256 boostAmount,
        uint256 expiry
    );

    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event ScoreEngineUpdated(address indexed oldEngine, address indexed newEngine);
    event LendingPoolUpdated(address indexed oldPool, address indexed newPool);

    // ═══════════════════════════════════════════════════════════════════════
    //  Constants & Custom Errors
    // ═══════════════════════════════════════════════════════════════════════
    uint256 public constant BLOCKS_PER_DAY = 7200; // ~12s per block on Creditcoin / EVM

    error ZeroAddress();
    error OnlyOwner();
    error InvalidAmount();
    error ProofAlreadyProcessed();
    error InvalidCryptographicProof();
    error InvalidBatchSize();
    error ArrayLengthMismatch();
    error CannotSelfDelegate();
    error InvalidBoostAmount();
    error InvalidDuration();
    error InsufficientDelegatorScore();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _verifierAddress, address _scoreEngineAddress) {
        if (_verifierAddress == address(0) || _scoreEngineAddress == address(0)) revert ZeroAddress();
        owner = msg.sender;
        attestationVerifier = IAttestationVerifier(_verifierAddress);
        scoreEngine = CreditScoreEngine(_scoreEngineAddress);
    }

    function setVerifier(address _newVerifier) external onlyOwner {
        if (_newVerifier == address(0)) revert ZeroAddress();
        emit VerifierUpdated(address(attestationVerifier), _newVerifier);
        attestationVerifier = IAttestationVerifier(_newVerifier);
    }

    function setScoreEngine(address _newScoreEngine) external onlyOwner {
        if (_newScoreEngine == address(0)) revert ZeroAddress();
        emit ScoreEngineUpdated(address(scoreEngine), _newScoreEngine);
        scoreEngine = CreditScoreEngine(_newScoreEngine);
    }

    function setLendingPool(address _lendingPool) external onlyOwner {
        if (_lendingPool == address(0)) revert ZeroAddress();
        emit LendingPoolUpdated(lendingPool, _lendingPool);
        lendingPool = _lendingPool;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Single Proof Submission (Upgraded with Multi-Factor Scoring)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Submits a transaction receipt & Merkle proof from Ethereum / Sepolia for native verification.
     * @param proof The packaged transaction inclusion & Merkle proof for Attestcoin.
     * @param actionType The category of financial event (multi-protocol support).
     * @param reportedValueUSD The USD amount (18 decimals) proven in the receipt.
     */
    function submitRepaymentProof(
        IAttestationVerifier.EventProof calldata proof,
        ActionType actionType,
        uint256 reportedValueUSD
    ) external override returns (bool success, uint256 newScore) {
        if (reportedValueUSD == 0) revert InvalidAmount();

        // 1. Replay Prevention
        bytes32 replayKey = keccak256(abi.encodePacked(proof.sourceChainId, proof.txHash, proof.txIndex));
        if (processedAttestations[replayKey]) revert ProofAlreadyProcessed();

        // 2. Cryptographic Verification via Attestcoin / BlockProver precompile (0x0FD2)
        IAttestationVerifier.AttestationResult memory result = attestationVerifier.verifyEventProof(proof);
        if (!result.isValid) revert InvalidCryptographicProof();

        processedAttestations[replayKey] = true;

        // 3. Update borrower profile with multi-factor data
        newScore = _updateBorrowerProfile(msg.sender, proof, actionType, reportedValueUSD, result, replayKey);

        emit ProofSubmittedAndVerified(replayKey, msg.sender, proof.sourceChainId, proof.txHash, actionType, reportedValueUSD, newScore);

        return (true, newScore);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Batch Proof Submission ("Import Your Entire Credit History")
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Submit multiple proofs in a single transaction for instant credit migration.
     * @dev This is CredX's killer feature — no competitor offers batch proof import.
     * @param proofs Array of transaction proofs from Ethereum / Sepolia.
     * @param actionTypes Corresponding action types for each proof.
     * @param reportedValuesUSD Corresponding USD values for each proof.
     */
    function submitBatchProofs(
        IAttestationVerifier.EventProof[] calldata proofs,
        ActionType[] calldata actionTypes,
        uint256[] calldata reportedValuesUSD
    ) external override returns (uint256 finalScore) {
        uint256 len = proofs.length;
        if (len == 0 || len > 20) revert InvalidBatchSize();
        if (len != actionTypes.length || len != reportedValuesUSD.length) revert ArrayLengthMismatch();

        uint256 totalBatchValueUSD = 0;

        for (uint256 i = 0; i < len; i++) {
            if (reportedValuesUSD[i] == 0) revert InvalidAmount();

            bytes32 replayKey = keccak256(abi.encodePacked(proofs[i].sourceChainId, proofs[i].txHash, proofs[i].txIndex));
            
            // Skip already-processed proofs silently (don't revert the whole batch)
            if (processedAttestations[replayKey]) {
                continue;
            }

            IAttestationVerifier.AttestationResult memory result = attestationVerifier.verifyEventProof(proofs[i]);
            if (!result.isValid) {
                continue; // Skip invalid proofs in batch mode
            }

            processedAttestations[replayKey] = true;
            totalBatchValueUSD += reportedValuesUSD[i];

            _updateBorrowerProfile(msg.sender, proofs[i], actionTypes[i], reportedValuesUSD[i], result, replayKey);
        }

        BorrowerProfile memory profile = borrowerProfiles[msg.sender];
        finalScore = profile.creditScore;

        emit BatchProofsSubmitted(msg.sender, len, totalBatchValueUSD, finalScore);

        return finalScore;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Credit Delegation / Social Lending
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Delegate a fraction of your credit reputation to vouch for another user.
     * @param beneficiary The address to boost.
     * @param boostAmount The CTS points to delegate (max 100).
     * @param durationDays How long the delegation lasts.
     */
    function delegateCredit(address beneficiary, uint256 boostAmount, uint256 durationDays) external {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (beneficiary == msg.sender) revert CannotSelfDelegate();
        if (boostAmount == 0 || boostAmount > 100) revert InvalidBoostAmount();
        if (durationDays == 0 || durationDays > 90) revert InvalidDuration();

        BorrowerProfile memory delegatorProfile = borrowerProfiles[msg.sender];
        uint256 delegatorScore = delegatorProfile.creditScore == 0 ? scoreEngine.MIN_SCORE() : delegatorProfile.creditScore;
        if (delegatorScore < 700) revert InsufficientDelegatorScore();

        uint256 expiryBlock = block.number + (durationDays * BLOCKS_PER_DAY);
        delegatedBoosts[beneficiary] = CreditDelegation({
            delegator: msg.sender,
            boostAmount: boostAmount,
            expiry: expiryBlock,
            isActive: true
        });

        emit CreditDelegated(msg.sender, beneficiary, boostAmount, expiryBlock);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Internal: Update Borrower Profile with Multi-Factor Data
    // ═══════════════════════════════════════════════════════════════════════

    function _updateProfileMetrics(
        address borrower,
        BorrowerProfile storage profile,
        uint256 sourceChainId,
        ActionType actionType,
        uint256 reportedValueUSD
    ) private {
        if (borrower == address(0)) revert ZeroAddress();

        profile.totalVerifiedVolumeUSD += reportedValueUSD;
        profile.totalAttestationsCount += 1;
        profile.lastAttestationTimestamp = block.number;

        if (sourceChainId == 1) {
            profile.isMainnetActive = true;
        }

        uint8 actionBit = uint8(1 << uint8(actionType));
        if ((borrowerActionBitmap[borrower] & actionBit) == 0) {
            borrowerActionBitmap[borrower] |= actionBit;
            profile.protocolDiversityCount += 1;
        }

        uint256 chainBit = 1 << (sourceChainId % 256);
        if ((borrowerChainBitmap[borrower] & chainBit) == 0) {
            borrowerChainBitmap[borrower] |= chainBit;
            profile.chainDiversityCount += 1;
        }

        uint256 weight = scoreEngine.getActionWeight(uint256(actionType));
        profile.weightedActionScore += (reportedValueUSD * weight) / 10000;
    }

    function _computeScoreWithBoost(address borrower, BorrowerProfile storage profile) private view returns (uint256) {
        if (borrower == address(0)) revert ZeroAddress();

        uint256 score = scoreEngine.computeScoreMultiFactor(
            profile.totalVerifiedVolumeUSD,
            profile.totalAttestationsCount,
            profile.lastAttestationTimestamp,
            profile.isMainnetActive,
            profile.protocolDiversityCount,
            profile.chainDiversityCount,
            profile.weightedActionScore
        );

        CreditDelegation memory delegation = delegatedBoosts[borrower];
        if (delegation.isActive && delegation.expiry > block.number) {
            score += delegation.boostAmount;
            if (score > scoreEngine.MAX_SCORE()) {
                score = scoreEngine.MAX_SCORE();
            }
        }
        return score;
    }

    function _updateBorrowerProfile(
        address borrower,
        IAttestationVerifier.EventProof calldata proof,
        ActionType actionType,
        uint256 reportedValueUSD,
        IAttestationVerifier.AttestationResult memory result,
        bytes32 replayKey
    ) internal returns (uint256 newScore) {
        if (borrower == address(0)) revert ZeroAddress();

        BorrowerProfile storage profile = borrowerProfiles[borrower];
        uint256 oldScore = profile.creditScore == 0 ? scoreEngine.MIN_SCORE() : profile.creditScore;

        _updateProfileMetrics(borrower, profile, proof.sourceChainId, actionType, reportedValueUSD);
        newScore = _computeScoreWithBoost(borrower, profile);
        profile.creditScore = newScore;

        bytes32 privacyCommitment = keccak256(abi.encodePacked(replayKey, borrower, block.number));
        _borrowerHistory[borrower].push(VerifiedAttestationRecord({
            proofHash: replayKey,
            sourceChainId: proof.sourceChainId,
            txHash: proof.txHash,
            borrower: borrower,
            actionType: actionType,
            valueUSD: reportedValueUSD,
            sourceTimestamp: result.sourceBlockTime,
            verifiedAt: block.number,
            privacyCommitment: privacyCommitment
        }));

        uint256 maxCreditLineUSD = scoreEngine.getMaxCreditLine(newScore, profile.totalVerifiedVolumeUSD);
        uint256 requiredCollateralRatioBps = scoreEngine.getCollateralRatio(newScore);

        emit CreditScoreUpdated(borrower, oldScore, newScore, maxCreditLineUSD, requiredCollateralRatioBps);

        return newScore;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════════════════════════════════

    function getBorrowerProfile(address borrower) external view override returns (
        uint256 creditScore,
        uint256 totalVerifiedVolumeUSD,
        uint256 totalAttestationsCount,
        uint256 maxCreditLineUSD,
        uint256 requiredCollateralRatioBps,
        uint256 lastAttestationTimestamp
    ) {
        if (borrower == address(0)) revert ZeroAddress();
        BorrowerProfile memory profile = borrowerProfiles[borrower];
        creditScore = profile.creditScore == 0 ? scoreEngine.MIN_SCORE() : profile.creditScore;
        totalVerifiedVolumeUSD = profile.totalVerifiedVolumeUSD;
        totalAttestationsCount = profile.totalAttestationsCount;
        lastAttestationTimestamp = profile.lastAttestationTimestamp;

        maxCreditLineUSD = scoreEngine.getMaxCreditLine(creditScore, totalVerifiedVolumeUSD);
        requiredCollateralRatioBps = scoreEngine.getCollateralRatio(creditScore);
    }

    /**
     * @notice Returns extended borrower profile including diversity metrics.
     */
    function getBorrowerProfileExtended(address borrower) external view returns (
        uint256 creditScore,
        uint256 totalVerifiedVolumeUSD,
        uint256 totalAttestationsCount,
        uint256 protocolDiversity,
        uint256 chainDiversity,
        uint256 weightedActionScore,
        uint256 interestRateBps,
        uint256 requiredCollateralRatioBps
    ) {
        if (borrower == address(0)) revert ZeroAddress();
        BorrowerProfile memory profile = borrowerProfiles[borrower];
        creditScore = profile.creditScore == 0 ? scoreEngine.MIN_SCORE() : profile.creditScore;
        totalVerifiedVolumeUSD = profile.totalVerifiedVolumeUSD;
        totalAttestationsCount = profile.totalAttestationsCount;
        protocolDiversity = profile.protocolDiversityCount;
        chainDiversity = profile.chainDiversityCount;
        weightedActionScore = profile.weightedActionScore;
        interestRateBps = scoreEngine.getInterestRate(creditScore);
        requiredCollateralRatioBps = scoreEngine.getCollateralRatio(creditScore);
    }

    function getBorrowerHistory(address borrower) external view returns (VerifiedAttestationRecord[] memory) {
        if (borrower == address(0)) revert ZeroAddress();
        return _borrowerHistory[borrower];
    }
}
