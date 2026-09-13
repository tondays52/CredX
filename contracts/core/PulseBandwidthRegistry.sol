// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title PulseBandwidthRegistry
 * @notice Live on-chain epoch ledger for the CredX Pulse bandwidth Data-DAO.
 *
 * @dev Node operators register their wallet and submit one bandwidth report per
 *      live epoch — so the network's "shared GB" is a real, replay-resistant
 *      ledger rather than a simulation. Reports are rate-limited by time epoch
 *      (one anchor per node per epoch), bounded by a bandwidth cap, quality-
 *      graded 1..4, chained to the node's previous anchor, and rewarded in
 *      PULSE units that are claimed on-chain by the operator.
 *
 *      Bandwidth figures are operator-signed session reports, not ISP-inspected
 *      bytes; the registry is an honest bolt-on anchor, not a claim of traffic
 *      interception.
 */
contract PulseBandwidthRegistry {
    address public owner;
    bool public paused;

    /// @notice PULSE reward units per anchored epoch (18 decimals).
    uint256 public rewardPerEpoch;
    /// @notice Absolute cap on reported bandwidth per epoch (MB).
    uint32 public maxBandwidthMB;
    /// @notice Length of one settlement epoch in seconds (default 24h).
    uint24 public epochDurationSeconds;
    /// @notice Wall-clock genesis; epoch 0 begins here.
    uint256 public genesisTime;

    uint256 public nodeCount;
    uint256 public totalEpochsSettled;
    uint256 public totalBandwidthMB;
    uint256 public totalRewardUnitsIssued;

    struct NodeInfo {
        uint256 nodeId;
        address operator;
        bytes4 nodeTag;
        uint256 epochCount;
        uint256 lastEpoch;
        uint32 lastBandwidthMB;
        uint8 lastQualityGrade;
        uint256 totalRewardUnits;
        uint256 claimedUnits;
        uint256 registeredAt;
        bytes32 lastAnchorHash;
    }

    mapping(address operator => NodeInfo info) public nodes;
    mapping(uint256 nodeId => address operator) public nodeOperators;

    event NodeRegistered(address indexed operator, uint256 indexed nodeId, bytes4 nodeTag, uint256 timestamp);
    event BandwidthAnchored(
        address indexed operator,
        uint256 indexed epochId,
        bytes32 indexed anchorHash,
        uint32 bandwidthMB,
        uint8 qualityGrade,
        uint256 rewardUnits,
        uint256 timestamp
    );
    event RewardsClaimed(address indexed operator, uint256 amount);
    event PauseToggled(bool paused);

    error OnlyOwner();
    error Paused();
    error ZeroNodeTag();
    error AlreadyRegistered();
    error NotRegistered();
    error BadBandwidth();
    error BadQuality();
    error EpochNotCurrent();
    error EpochStale();
    error NothingToClaim();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(uint24 _epochDurationSeconds) {
        owner = msg.sender;
        epochDurationSeconds = _epochDurationSeconds == 0 ? 86400 : _epochDurationSeconds;
        genesisTime = block.timestamp;
        rewardPerEpoch = 1_000e18;
        maxBandwidthMB = 5_000_000;
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PauseToggled(p);
    }

    function setRewardPerEpoch(uint256 v) external onlyOwner {
        rewardPerEpoch = v;
    }

    function setMaxBandwidthMB(uint32 v) external onlyOwner {
        maxBandwidthMB = v;
    }

    function setEpochDurationSeconds(uint24 v) external onlyOwner {
        epochDurationSeconds = v == 0 ? 86400 : v;
    }

    function currentEpoch() public view returns (uint256) {
        return (block.timestamp - genesisTime) / uint256(epochDurationSeconds);
    }

    function registerNode(bytes4 nodeTag) external {
        if (paused) revert Paused();
        if (nodeTag == bytes4(0)) revert ZeroNodeTag();
        if (nodes[msg.sender].operator != address(0)) revert AlreadyRegistered();

        nodeCount += 1;
        NodeInfo storage n = nodes[msg.sender];
        n.nodeId = nodeCount;
        n.operator = msg.sender;
        n.nodeTag = nodeTag;
        n.registeredAt = block.timestamp;
        n.lastEpoch = 0;
        nodeOperators[nodeCount] = msg.sender;

        emit NodeRegistered(msg.sender, nodeCount, nodeTag, block.timestamp);
    }

    /**
     * @notice Submit one bandwidth report for the live epoch.
     * @dev One anchor per node per epoch; strictly increasing epoch ids;
     *      bandwidth within a capped, honest corridor; quality graded 1..4.
     */
    function submitBandwidth(uint32 bandwidthMB, uint8 qualityGrade) external {
        if (paused) revert Paused();
        NodeInfo storage n = nodes[msg.sender];
        if (n.operator == address(0)) revert NotRegistered();
        if (bandwidthMB == 0 || bandwidthMB > maxBandwidthMB) revert BadBandwidth();
        if (qualityGrade == 0 || qualityGrade > 4) revert BadQuality();

        uint256 epochId = currentEpoch();
        if (n.epochCount > 0 && epochId <= n.lastEpoch) revert EpochStale();

        uint256 units = rewardPerEpoch * uint256(qualityGrade);
        n.epochCount += 1;
        n.lastEpoch = epochId;
        n.lastBandwidthMB = bandwidthMB;
        n.lastQualityGrade = qualityGrade;
        n.totalRewardUnits += units;
        n.lastAnchorHash = keccak256(abi.encodePacked(n.lastAnchorHash, epochId, bandwidthMB, qualityGrade));

        totalEpochsSettled += 1;
        totalBandwidthMB += bandwidthMB;
        totalRewardUnitsIssued += units;

        emit BandwidthAnchored(
            msg.sender,
            epochId,
            n.lastAnchorHash,
            bandwidthMB,
            qualityGrade,
            units,
            block.timestamp
        );
    }

    function claimRewards() external {
        if (paused) revert Paused();
        NodeInfo storage n = nodes[msg.sender];
        if (n.operator == address(0)) revert NotRegistered();
        uint256 unpaid = n.totalRewardUnits - n.claimedUnits;
        if (unpaid == 0) revert NothingToClaim();
        n.claimedUnits = n.totalRewardUnits;
        emit RewardsClaimed(msg.sender, unpaid);
    }

    function getNode(address operator) external view returns (NodeInfo memory) {
        return nodes[operator];
    }
}