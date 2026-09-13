// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title AiComputeRegistry
 * @notice Live on-chain AI compute Data-DAO ledger for the CredXsor AI compute market.
 *
 * @dev Compute providers register their wallet with declared hardware specs (model
 *      tag, VRAM, peak TFLOPS) and settle compute sessions on Creditcoin. A session
 *      carries the operator-attested session minutes, a 1–4 quality grade and a
 *      Merkle root over the client-computed evidence (e.g. the real browser-native
 *      benchmark result produced on this device) — chained to the provider's previous
 *      anchor and rewarded in CREDX units (rate-limited by time to stay honest &
 *      spam-resistant). Operators claim their accrued units.
 *
 *      Session minutes and hardware specs are operator-signed reports, an honest
 *      Data-DAO ledger like Pulse (bandwidth) and Nexus (IoT detections) — not a
 *      claim of executing untrusted third-party jobs wholesale.
 */
contract AiComputeRegistry {
    address public owner;
    bool public paused;

    /// @notice CREDX reward units per session-minute (18 decimals).
    uint256 public rewardUnitsPerMinute;
    /// @notice Highest allowed quality grade.
    uint32 public maxGrade;
    /// @notice Minimum wall-clock separation between sessions per provider.
    uint32 public minSecondsBetweenSessions;
    /// @notice Upper bound of operator-reported peak TFLOPS per session-minute basis.
    uint32 public maxSessionMinutes;

    uint256 public providerCount;
    uint256 public totalSessionsSettled;
    uint256 public totalSessionMinutes;
    uint256 public totalRewardUnitsIssued;

    struct Provider {
        uint256 providerId;
        address operator;
        bytes4 modelTag;
        uint32 vramGb;
        uint32 tflops;
        uint80 sessionSeq;
        uint256 totalSessionMinutes;
        uint256 totalRewardUnits;
        uint256 claimedUnits;
        uint40 lastSettledAt;
        bytes32 lastAnchorHash;
    }

    mapping(address operator => Provider info) public providers;
    mapping(uint256 providerId => address operator) public providerOperators;

    event ProviderRegistered(
        address indexed operator,
        uint256 indexed providerId,
        bytes4 modelTag,
        uint32 vramGb,
        uint32 tflops,
        uint256 timestamp
    );
    event ComputeSessionSettled(
        address indexed operator,
        uint256 indexed sessionSeq,
        bytes32 indexed merkleRoot,
        uint32 sessionMinutes,
        uint8 qualityGrade,
        uint256 rewardUnits,
        uint256 timestamp
    );
    event RewardsClaimed(address indexed operator, uint256 amount);
    event PauseToggled(bool paused);

    error OnlyOwner();
    error Paused();
    error ZeroModelTag();
    error AlreadyRegistered();
    error NotRegistered();
    error BadSpec();
    error BadSessionMinutes();
    error BadQuality();
    error ZeroMerkleRoot();
    error TooFrequent();
    error NothingToClaim();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(uint32 _minSecondsBetweenSessions) {
        owner = msg.sender;
        minSecondsBetweenSessions = _minSecondsBetweenSessions == 0 ? 60 : _minSecondsBetweenSessions;
        rewardUnitsPerMinute = 10e18;
        maxGrade = 4;
        maxSessionMinutes = 1_440;
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PauseToggled(p);
    }

    function setRewardUnitsPerMinute(uint256 v) external onlyOwner {
        rewardUnitsPerMinute = v;
    }

    function setMinSecondsBetweenSessions(uint32 v) external onlyOwner {
        minSecondsBetweenSessions = v;
    }

    /**
     * @notice Register a compute provider with declared hardware specs.
     * @dev modelTag, VRAM and TFLOPS are operator-reported declarations stored
     *      on-chain (like an edge tag), not benchmarked on first registration.
     */
    function registerProvider(bytes4 modelTag, uint32 vramGb, uint32 tflops) external {
        if (paused) revert Paused();
        if (modelTag == bytes4(0)) revert ZeroModelTag();
        if (vramGb == 0 || tflops == 0) revert BadSpec();
        if (providers[msg.sender].operator != address(0)) revert AlreadyRegistered();

        providerCount += 1;
        Provider storage p = providers[msg.sender];
        p.providerId = providerCount;
        p.operator = msg.sender;
        p.modelTag = modelTag;
        p.vramGb = vramGb;
        p.tflops = tflops;
        p.lastSettledAt = uint40(block.timestamp);
        providerOperators[providerCount] = msg.sender;

        emit ProviderRegistered(msg.sender, providerCount, modelTag, vramGb, tflops, block.timestamp);
    }

    /**
     * @notice Settle one compute session for a registered provider.
     * @dev Rate-limited by time; validated minutes/grade/root; rewards scale with
     *      session minutes and quality grade. Each session is chained to the
     *      provider's previous anchor.
     */
    function settleSession(uint32 sessionMinutes, uint8 qualityGrade, bytes32 merkleRoot) external {
        if (paused) revert Paused();
        Provider storage p = providers[msg.sender];
        if (p.operator == address(0)) revert NotRegistered();
        if (sessionMinutes == 0 || sessionMinutes > maxSessionMinutes) revert BadSessionMinutes();
        if (qualityGrade == 0 || qualityGrade > maxGrade) revert BadQuality();
        if (merkleRoot == bytes32(0)) revert ZeroMerkleRoot();
        if (p.sessionSeq > 0 && block.timestamp < p.lastSettledAt + uint256(minSecondsBetweenSessions)) revert TooFrequent();

        uint256 seq = p.sessionSeq + 1;
        uint256 units = rewardUnitsPerMinute * uint256(sessionMinutes) * uint256(qualityGrade);

        bytes32 anchor = keccak256(
            abi.encodePacked(p.lastAnchorHash, seq, sessionMinutes, qualityGrade, merkleRoot, block.timestamp)
        );

        p.sessionSeq = uint80(seq);
        p.totalSessionMinutes += sessionMinutes;
        p.totalRewardUnits += units;
        p.lastSettledAt = uint40(block.timestamp);
        p.lastAnchorHash = anchor;

        totalSessionsSettled += 1;
        totalSessionMinutes += sessionMinutes;
        totalRewardUnitsIssued += units;

        emit ComputeSessionSettled(
            msg.sender,
            seq,
            merkleRoot,
            sessionMinutes,
            qualityGrade,
            units,
            block.timestamp
        );
    }

    function claimRewards() external {
        if (paused) revert Paused();
        Provider storage p = providers[msg.sender];
        if (p.operator == address(0)) revert NotRegistered();
        uint256 unpaid = p.totalRewardUnits - p.claimedUnits;
        if (unpaid == 0) revert NothingToClaim();
        p.claimedUnits = p.totalRewardUnits;
        emit RewardsClaimed(msg.sender, unpaid);
    }

    function getProvider(address operator) external view returns (Provider memory) {
        return providers[operator];
    }
}