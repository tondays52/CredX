// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title NexusEdgeRegistry
 * @notice Live on-chain detection ledger for the CredX Nexus IoT edge.
 *
 * @dev IoT edge operators register their wallet and settle batches of
 *      proximity detections on Creditcoin. A batch carries a client-computed
 *      Merkle root over the observed BLE advertising frames, the detection
 *      count, and a signal-quality grade — chained to the edge's previous
 *      anchor and rewarded in NEXUS units (rate-limited by time to stay
 *      honest & spam-resistant). Operators claim their accrued units.
 *
 *      The Merkle root is operator-signed, an honest witness anchor, not a
 *      claim of intercepting untrusted third-party traffic wholesale; the
 *      edge node reports enumerations it actually observed.
 */
contract NexusEdgeRegistry {
    address public owner;
    bool public paused;

    /// @notice NEXUS reward units per anchored detection (18 decimals).
    uint256 public rewardPerDetection;
    /// @notice Upper bound of detections claimable per batch.
    uint32 public maxDetectionsPerBatch;
    /// @notice Minimum wall-clock separation between batches per edge.
    uint32 public minSecondsBetweenBatches;

    uint256 public edgeCount;
    uint256 public totalBatchesSettled;
    uint256 public totalDetectionsAnchored;
    uint256 public totalRewardUnitsIssued;

    struct EdgeNode {
        uint256 edgeId;
        address operator;
        bytes4 edgeTag;
        uint256 batchCount;
        uint256 lastBatchSeq;
        uint32 lastDetectionsCount;
        uint8 lastQualityGrade;
        bytes32 lastMerkleRoot;
        uint256 totalDetections;
        uint256 totalRewardUnits;
        uint256 claimedUnits;
        uint256 lastBatchTime;
        bytes32 lastAnchorHash;
    }

    mapping(address operator => EdgeNode info) public edges;
    mapping(uint256 edgeId => address operator) public edgeOperators;

    event EdgeRegistered(address indexed operator, uint256 indexed edgeId, bytes4 edgeTag, uint256 timestamp);
    event DetectionBatchSettled(
        address indexed operator,
        uint256 indexed batchSeq,
        bytes32 indexed merkleRoot,
        uint32 detectionsCount,
        uint8 qualityGrade,
        uint256 rewardUnits,
        uint256 timestamp
    );
    event RewardsClaimed(address indexed operator, uint256 amount);
    event PauseToggled(bool paused);

    error OnlyOwner();
    error Paused();
    error ZeroEdgeTag();
    error AlreadyRegistered();
    error NotRegistered();
    error BadDetectionCount();
    error BadQuality();
    error ZeroMerkleRoot();
    error TooFrequent();
    error NothingToClaim();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(uint32 _minSecondsBetweenBatches) {
        owner = msg.sender;
        minSecondsBetweenBatches = _minSecondsBetweenBatches == 0 ? 60 : _minSecondsBetweenBatches;
        rewardPerDetection = 10e18;
        maxDetectionsPerBatch = 5_000;
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PauseToggled(p);
    }

    function setRewardPerDetection(uint256 v) external onlyOwner {
        rewardPerDetection = v;
    }

    function setMaxDetectionsPerBatch(uint32 v) external onlyOwner {
        maxDetectionsPerBatch = v;
    }

    function setMinSecondsBetweenBatches(uint32 v) external onlyOwner {
        minSecondsBetweenBatches = v;
    }

    function registerEdge(bytes4 edgeTag) external {
        if (paused) revert Paused();
        if (edgeTag == bytes4(0)) revert ZeroEdgeTag();
        if (edges[msg.sender].operator != address(0)) revert AlreadyRegistered();

        edgeCount += 1;
        EdgeNode storage e = edges[msg.sender];
        e.edgeId = edgeCount;
        e.operator = msg.sender;
        e.edgeTag = edgeTag;
        e.lastBatchSeq = 0;
        e.lastBatchTime = block.timestamp;
        edgeOperators[edgeCount] = msg.sender;

        emit EdgeRegistered(msg.sender, edgeCount, edgeTag, block.timestamp);
    }

    /**
     * @notice Settle one detection batch for a registered edge operator.
     * @dev Rate-limited by time; strictly increasing batch sequence; count,
     *      quality and Merkle root all bounded/validated. Rewards scale with
     *      detection count and quality grade.
     */
    function settleBatch(uint32 detectionsCount, uint8 qualityGrade, bytes32 merkleRoot) external {
        if (paused) revert Paused();
        EdgeNode storage e = edges[msg.sender];
        if (e.operator == address(0)) revert NotRegistered();
        if (detectionsCount == 0 || detectionsCount > maxDetectionsPerBatch) revert BadDetectionCount();
        if (qualityGrade == 0 || qualityGrade > 4) revert BadQuality();
        if (merkleRoot == bytes32(0)) revert ZeroMerkleRoot();
        if (e.batchCount > 0 && block.timestamp < e.lastBatchTime + uint256(minSecondsBetweenBatches)) revert TooFrequent();

        uint256 seq = e.lastBatchSeq + 1;
        uint256 units = rewardPerDetection * uint256(detectionsCount) * uint256(qualityGrade);

        e.batchCount += 1;
        e.lastBatchSeq = seq;
        e.lastDetectionsCount = detectionsCount;
        e.lastQualityGrade = qualityGrade;
        e.lastMerkleRoot = merkleRoot;
        e.totalDetections += detectionsCount;
        e.totalRewardUnits += units;
        e.lastBatchTime = block.timestamp;
        e.lastAnchorHash = keccak256(abi.encodePacked(e.lastAnchorHash, seq, detectionsCount, qualityGrade, merkleRoot));

        totalBatchesSettled += 1;
        totalDetectionsAnchored += detectionsCount;
        totalRewardUnitsIssued += units;

        emit DetectionBatchSettled(
            msg.sender,
            seq,
            merkleRoot,
            detectionsCount,
            qualityGrade,
            units,
            block.timestamp
        );
    }

    function claimRewards() external {
        if (paused) revert Paused();
        EdgeNode storage e = edges[msg.sender];
        if (e.operator == address(0)) revert NotRegistered();
        uint256 unpaid = e.totalRewardUnits - e.claimedUnits;
        if (unpaid == 0) revert NothingToClaim();
        e.claimedUnits = e.totalRewardUnits;
        emit RewardsClaimed(msg.sender, unpaid);
    }

    function getEdge(address operator) external view returns (EdgeNode memory) {
        return edges[operator];
    }
}