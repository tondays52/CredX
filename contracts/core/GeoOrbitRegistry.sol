// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title GeoOrbitRegistry
 * @notice Live on-chain telemetry anchor for the CredX GeoOrbit RTK mesh.
 *
 * @dev Stations register on Creditcoin and stream Proof-of-Space-Time (PoST)
 *      heartbeats. Every heartbeat is chained to the previous one — position
 *      proofs can never be reordered — and bounded by a speed envelope, so a
 *      station can never teleport. Rewards accrue as ORBIT units per heartbeat
 *      and are claimed on-chain by the operator.
 *
 *      Observables (lat/lng/alt/satellites/tdop) are operator-reported by the
 *      connected station wallet; GNSS raw-observation verification
 *      (SNR/doppler/carrier-phase digests) is deliberately kept out-of-scope so
 *      the registry is an honest, tamper-resistant anchor rather than a claim
 *      of hardware attestation it does not perform.
 */
contract GeoOrbitRegistry {
    address public owner;
    bool public paused;

    /// @notice ORBIT units awarded per accepted heartbeat (18 decimals).
    uint256 public rewardPerTelemetry;
    /// @notice Minimum blocks between heartbeats of the same station.
    uint256 public minTelemetryIntervalBlocks;
    /// @notice Maximum plausible ground speed (m/s) for a PoST continuity check.
    uint256 public maxSpeedMps;

    uint256 public stationCount;
    uint256 public totalTelemetryAnchored;
    uint256 public totalRewardUnitsIssued;

    struct Fix {
        int32 latE7; // degrees * 1e7
        int32 lngE7; // degrees * 1e7
        uint32 hMeters;
    }

    struct StationFix {
        Fix fix;
        uint8 satellites;
        uint16 tdop; // tenths of tdop (e.g. 18 => 1.8)
        uint40 timestamp;
        bytes32 antennaHash;
    }

    struct StationInfo {
        uint256 stationId;
        address operator;
        bytes4 hexId;
        uint256 telemetryCount;
        uint256 totalRewardUnits;
        uint256 claimedUnits;
        StationFix lastFix;
        bytes32 lastPosHash;
        uint256 lastTelemetryBlock;
    }

    mapping(address operator => StationInfo info) public stations;
    mapping(uint256 stationId => address operator) public operators;

    event StationRegistered(
        address indexed operator,
        uint256 indexed stationId,
        bytes4 hexId,
        int32 latE7,
        int32 lngE7,
        uint32 hMeters,
        uint256 timestamp
    );
    event TelemetryAnchored(
        address indexed operator,
        uint256 indexed nonce,
        bytes32 indexed posHash,
        int32 latE7,
        int32 lngE7,
        uint32 hMeters,
        uint8 satellites,
        uint256 timestamp
    );
    event RewardsClaimed(address indexed operator, uint256 amount);
    event PauseToggled(bool paused);

    error OnlyOwner();
    error Paused();
    error ZeroHexId();
    error BadFix();
    error AlreadyRegistered();
    error NotRegistered();
    error TooFrequent();
    error SpeedViolation();
    error NothingToClaim();

    /// @dev One degree of latitude ~= 111.32 km. The PoST envelope is axis-max
    ///      based (conservative at high latitudes), keeping the continuity check
    ///      simple and cheap — bounded, honest continuity, not geodesy.
    uint256 private constant METERS_PER_DEGREE = 111_320;
    int256 private constant E7 = 10_000_000;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        rewardPerTelemetry = 1_000e18;
        minTelemetryIntervalBlocks = 1;
        maxSpeedMps = 30;
    }

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PauseToggled(p);
    }

    function setRewardPerTelemetry(uint256 v) external onlyOwner {
        rewardPerTelemetry = v;
    }

    function setMinTelemetryIntervalBlocks(uint256 v) external onlyOwner {
        minTelemetryIntervalBlocks = v;
    }

    function setMaxSpeedMps(uint256 v) external onlyOwner {
        maxSpeedMps = v;
    }

    function registerStation(bytes4 hexId, int32 latE7, int32 lngE7, uint32 hMeters) external {
        if (paused) revert Paused();
        if (hexId == bytes4(0)) revert ZeroHexId();
        if (!_inRange(latE7, lngE7)) revert BadFix();
        if (stations[msg.sender].operator != address(0)) revert AlreadyRegistered();

        stationCount += 1;
        StationInfo storage s = stations[msg.sender];
        s.stationId = stationCount;
        s.operator = msg.sender;
        s.hexId = hexId;
        s.lastFix.fix = Fix(latE7, lngE7, hMeters);
        s.lastFix.timestamp = uint40(block.timestamp);
        s.lastPosHash = keccak256(abi.encodePacked(latE7, lngE7, hMeters));
        operators[stationCount] = msg.sender;

        emit StationRegistered(msg.sender, stationCount, hexId, latE7, lngE7, hMeters, block.timestamp);
    }

    /**
     * @notice Stream a PoST heartbeat from a registered station.
     * @dev Chains the fix to the previous one and enforces the speed envelope;
     *      accrues reward units to the operator.
     */
    function submitTelemetry(
        int32 latE7,
        int32 lngE7,
        uint32 hMeters,
        uint8 satellites,
        uint16 tdop,
        bytes32 antennaHash
    ) external {
        if (paused) revert Paused();
        StationInfo storage s = stations[msg.sender];
        if (s.operator == address(0)) revert NotRegistered();
        if (!_inRange(latE7, lngE7)) revert BadFix();
        if (satellites == 0 || tdop == 0 || tdop > 100) revert BadFix();

        if (s.lastTelemetryBlock != 0) {
            if (block.number - s.lastTelemetryBlock < minTelemetryIntervalBlocks) revert TooFrequent();
            uint256 elapsed = block.timestamp - uint256(s.lastFix.timestamp);
            if (elapsed > 0) {
                uint256 meters = _envelopeMeters(s.lastFix.fix.latE7, s.lastFix.fix.lngE7, latE7, lngE7);
                if (meters > maxSpeedMps * elapsed) revert SpeedViolation();
            }
        }

        s.telemetryCount += 1;
        s.totalRewardUnits += rewardPerTelemetry;
        totalTelemetryAnchored += 1;
        totalRewardUnitsIssued += rewardPerTelemetry;

        s.lastFix.fix = Fix(latE7, lngE7, hMeters);
        s.lastFix.satellites = satellites;
        s.lastFix.tdop = tdop;
        s.lastFix.timestamp = uint40(block.timestamp);
        s.lastFix.antennaHash = antennaHash;
        s.lastTelemetryBlock = block.number;
        s.lastPosHash = keccak256(
            abi.encodePacked(s.lastPosHash, uint32(block.timestamp), latE7, lngE7, hMeters, antennaHash)
        );

        emit TelemetryAnchored(
            msg.sender,
            s.telemetryCount,
            s.lastPosHash,
            latE7,
            lngE7,
            hMeters,
            satellites,
            block.timestamp
        );
    }

    function claimRewards() external {
        if (paused) revert Paused();
        StationInfo storage s = stations[msg.sender];
        if (s.operator == address(0)) revert NotRegistered();
        uint256 unpaid = s.totalRewardUnits - s.claimedUnits;
        if (unpaid == 0) revert NothingToClaim();
        s.claimedUnits = s.totalRewardUnits;
        emit RewardsClaimed(msg.sender, unpaid);
    }

    function getStation(address operator) external view returns (StationInfo memory) {
        return stations[operator];
    }

    /// @dev Axis-max envelope distance in meters (conservative at high latitude).
    function _envelopeMeters(int32 aLat, int32 aLng, int32 bLat, int32 bLng) private pure returns (uint256) {
        int256 dLat = int256(bLat) - int256(aLat);
        int256 dLng = int256(bLng) - int256(aLng);
        if (dLat < 0) dLat = -dLat;
        if (dLng < 0) dLng = -dLng;
        int256 largest = dLat > dLng ? dLat : dLng;
        return uint256(largest) * METERS_PER_DEGREE / uint256(E7);
    }

    function _inRange(int32 latE7, int32 lngE7) private pure returns (bool) {
        return latE7 >= -90 * int32(E7) &&
               latE7 <= 90 * int32(E7) &&
               lngE7 >= -180 * int32(E7) &&
               lngE7 <= 180 * int32(E7);
    }
}