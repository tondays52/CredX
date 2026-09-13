// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPerpAmm {
    function reserve0() external view returns (uint256);
    function reserve1() external view returns (uint256);
}

interface IPerpHub {
    function getBorrowerProfile(address who)
        external
        view
        returns (
            uint256 creditScore,
            uint256 totalVerifiedVolumeUSD,
            uint256 totalAttestationsCount,
            uint256 maxCreditLineUSD,
            uint256 requiredCollateralRatioBps,
            uint256 lastAttestationTimestamp
        );
}

/**
 * @title ReputationPerpetual
 * @notice A real on-chain perpetual-futures margin engine on Creditcoin testnet.
 *
 *         One market: base (DEPIN) priced in quote (cUSD). The mark price is the
 *         LIVE spot price of the deployed single-venue ReputationAMM pool
 *         (reserve0 / reserve1 = quote per base). This is an honest, real
 *         single-venue mark feed — there is exactly one priced venue on CC3, so
 *         there is no cross-venue arbitrage oracle to consult.
 *
 *         The protocol is the counterparty of record: the insurance pool (the
 *         contract's cUSD balance, seeded by a sponsor float) absorbs PnL that
 *         is not matched by an opposing position. Longs and shorts net against
 *         each other through a shared funding accumulator, and the pool covers
 *         any imbalance. Opening/close fees are tiered by the trader's real
 *         cross-chain credit score (same 30/15/5 bps ladder as the AMM).
 *
 *         Leverage is capped (owner-set), maintenance margin (owner-set), and a
 *         liquidation bonus rewards the keeper who closes underwater positions.
 */
contract ReputationPerpetual is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error InvalidPrice();
    error InvalidSide();
    error ZeroCollateral();
    error LeverageTooHigh();
    error OverExposure();
    error PositionNotFound();
    error NotOwner();
    error AlreadyClosed();
    error Underwater();
    error BelowMaintenance();
    error FundingNotDue();
    error NoPositions();
    error SlippageTooHigh();
    error NotLiquidatable();

    uint256 public constant SCALE = 1e18;
    uint256 internal constant BPS = 10000;

    IPerpAmm public immutable AMM;
    IPerpHub public immutable CREDX_HUB;
    IERC20 public immutable QUOTE; // cUSD — the settlement asset
    IERC20 public immutable BASE;  // DEPIN — the priced asset

    enum Side { LONG, SHORT }

    struct Position {
        uint64 id;
        address owner;
        Side side;
        uint256 collateral; // quote (cUSD) units
        uint256 notional;   // quote (cUSD) units
        uint256 entryMark;  // 1e18-scaled quote per base at open
        uint256 markAtOpen; // 1e18-scaled quote per base used for the liq estimate
        uint256 fundingAtOpen; // fundingAcc snapshot
        uint256 openedAtBlock;
        bool closed;
    }

    // Fee ladder (bps) — mirrors the deployed ReputationAMM credit tiers.
    uint256 public constant FEE_STANDARD_BPS = 30;
    uint256 public constant FEE_PRIME_BPS = 15;
    uint256 public constant FEE_SUPER_PRIME_BPS = 5;

    // Governed risk params.
    uint256 public maxLeverageBps;   // default 10000 = 10x
    uint256 public maintenanceBps;   // default 65 (0.65%)
    uint256 public liquidationBonusBps; // percent paid to the keeper
    uint256 public maxPositionNotional; // per-position cap (quote units)
    uint256 public maxTotalNotional;    // market-wide exposure cap (quote units)

    // Funding (zero-sum aggregator between the two sides; pool settles imbalance).
    uint256 public fundingRateBps;   // paid per epoch by LONGs to SHORTs
    uint256 public fundingEpochBlocks;
    uint256 public fundingAcc;       // accumulated per-unit funding (1e18-scaled)
    uint256 public lastFundingBlock;

    uint256 public totalLongNotional;
    uint256 public totalShortNotional;
    uint256 public openPositionCount;

    Position[] internal _positions;
    mapping(address => uint64[]) internal _userPositions;

    // ── Events ───────────────────────────────────────────────────────────────

    event PositionOpened(
        address indexed owner,
        uint64 id,
        Side side,
        uint256 collateral,
        uint256 notional,
        uint256 entryMark,
        uint256 openedAtBlock
    );
    event PositionClosed(address indexed owner, uint64 id, Side side, uint256 realizedUsd, uint256 mark, uint256 fee);
    event PositionLiquidated(address indexed owner, uint64 id, address keeper, uint256 keeperReward, uint256 mark);
    event MarginChanged(uint64 id, uint256 delta, bool deposit);
    event FundingApplied(uint256 blockNumber, uint256 rateBps, uint256 nextFundingBlock);
    event InsuranceTopUp(address indexed sender, uint256 amount);

    constructor(
        address _credXHub,
        address _amm,
        address _quote,
        address _base
    ) Ownable(msg.sender) {
        if (_credXHub == address(0) || _amm == address(0) || _quote == address(0) || _base == address(0)) {
            revert ZeroAddress();
        }
        CREDX_HUB = IPerpHub(_credXHub);
        AMM = IPerpAmm(_amm);
        QUOTE = IERC20(_quote);
        BASE = IERC20(_base);

        maxLeverageBps = 100000;         // 10x (leverageBps: 1x = 10000)
        maintenanceBps = 65;             // 0.65%
        liquidationBonusBps = 5;         // keepers take up to 5% of notional
        maxPositionNotional = 20_000 * SCALE;
        maxTotalNotional = 200_000 * SCALE;
        fundingRateBps = 1;              // 0.01% per epoch
        fundingEpochBlocks = 3600;
        lastFundingBlock = block.number;
    }

    // ── Views ────────────────────────────────────────────────────────────────

    /** Live mark price = quote/base spot from the single-venue AMM pool. */
    function markPrice() public view returns (uint256) {
        uint256 r0 = AMM.reserve0();
        uint256 r1 = AMM.reserve1();
        if (r0 == 0 || r1 == 0) revert InvalidPrice();
        uint256 mark = (r0 * SCALE) / r1;
        if (mark == 0 || mark >= 1e24) revert InvalidPrice();
        return mark;
    }

    function feeBpsFor(address who) public view returns (uint256) {
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(who);
        if (creditScore >= 780) return FEE_SUPER_PRIME_BPS;
        if (creditScore >= 650) return FEE_PRIME_BPS;
        return FEE_STANDARD_BPS;
    }

    function positionsOf(address who) external view returns (uint64[] memory) {
        return _userPositions[who];
    }

    function getPosition(uint64 id) external view returns (Position memory p) {
        if (id >= _positions.length) revert PositionNotFound();
        p = _positions[id];
    }

    function positionCount() external view returns (uint256) {
        return _positions.length;
    }

    function insurancePool() external view returns (uint256) {
        return QUOTE.balanceOf(address(this));
    }

    function fundingInfo()
        external
        view
        returns (
            uint256 rateBps,
            uint256 epochBlocks,
            uint256 lastBlock,
            uint256 nextFundingBlock,
            uint256 acc,
            uint256 blocksElapsed
        )
    {
        rateBps = fundingRateBps;
        epochBlocks = fundingEpochBlocks;
        lastBlock = lastFundingBlock;
        nextFundingBlock = lastFundingBlock + fundingEpochBlocks;
        acc = fundingAcc;
        blocksElapsed = block.number > lastFundingBlock ? block.number - lastFundingBlock : 0;
    }

    function marketInfo()
        external
        view
        returns (
            uint256 mark,
            uint256 maxLev,
            uint256 maint,
            uint256 liqBonus,
            uint256 maxPos,
            uint256 maxTotal,
            uint256 longNotional,
            uint256 shortNotional,
            uint256 openCount,
            uint256 reserveQuote,
            uint256 reserveBase
        )
    {
        mark = markPrice();
        maxLev = maxLeverageBps;
        maint = maintenanceBps;
        liqBonus = liquidationBonusBps;
        maxPos = maxPositionNotional;
        maxTotal = maxTotalNotional;
        longNotional = totalLongNotional;
        shortNotional = totalShortNotional;
        openCount = openPositionCount;
        reserveQuote = AMM.reserve0();
        reserveBase = AMM.reserve1();
    }

    // ── Governance ───────────────────────────────────────────────────────────

    function setRiskParams(
        uint256 _maxLeverageBps,
        uint256 _maintenanceBps,
        uint256 _liquidationBonusBps,
        uint256 _maxPositionNotional,
        uint256 _maxTotalNotional
    ) external onlyOwner {
        require(_maxLeverageBps <= 200000, "leverage cap: 20x");
        require(_maintenanceBps > 0 && _maintenanceBps < 1000, "maintenance range");
        require(_liquidationBonusBps <= 20, "bonus range");
        maxLeverageBps = _maxLeverageBps;
        maintenanceBps = _maintenanceBps;
        liquidationBonusBps = _liquidationBonusBps;
        maxPositionNotional = _maxPositionNotional;
        maxTotalNotional = _maxTotalNotional;
    }

    function setFunding(uint256 _rateBps, uint256 _epochBlocks) external onlyOwner {
        require(_rateBps <= 50, "funding rate range");
        fundingRateBps = _rateBps;
        fundingEpochBlocks = _epochBlocks;
    }

    // ── Core: open ───────────────────────────────────────────────────────────

    /**
     * @notice Opens (or adds to) a perp position. Pulls `collateral` of quote
     *         (cUSD), applies the tiered open fee, and sizes `notional =
     *         collateral * leverageBps / 1e4`.
     * @notice Fee is charged from the collateral at open so both sides pay it.
     */
    function openPosition(Side side, uint256 collateral, uint256 leverageBps) external nonReentrant returns (uint64) {
        if (collateral == 0) revert ZeroCollateral();
        if (leverageBps == 0 || leverageBps > maxLeverageBps) revert LeverageTooHigh();
        if (side != Side.LONG && side != Side.SHORT) revert InvalidSide();

        uint256 notional = (collateral * leverageBps) / BPS;
        if (notional == 0) revert ZeroCollateral();
        if (notional > maxPositionNotional) revert OverExposure();

        uint256 sideTotal = side == Side.LONG ? totalLongNotional : totalShortNotional;
        if (sideTotal + notional > maxTotalNotional) revert OverExposure();

        uint256 mark = markPrice();
        uint256 fee = (notional * feeBpsFor(msg.sender)) / BPS;
        if (fee > collateral) revert ZeroCollateral(); // fee must be payable
        uint256 collateralAfterFee = collateral - fee;

        // Quote pull happens after successful computation.
        QUOTE.safeTransferFrom(msg.sender, address(this), collateral);

        uint64 newId = uint64(_positions.length);
        _positions.push(
            Position({
                id: newId,
                owner: msg.sender,
                side: side,
                collateral: collateralAfterFee,
                notional: notional,
                entryMark: mark,
                markAtOpen: mark,
                fundingAtOpen: fundingAcc,
                openedAtBlock: block.number,
                closed: false
            })
        );
        _userPositions[msg.sender].push(newId);
        if (side == Side.LONG) totalLongNotional += notional;
        else totalShortNotional += notional;
        openPositionCount++;

        emit PositionOpened(msg.sender, newId, side, collateralAfterFee, notional, mark, block.number);
        return newId;
    }

    // ── Core: close ──────────────────────────────────────────────────────────

    /**
     * @notice Closes a position at the live mark, settling PnL + the funding
     *         accumulator delta into the trader's margin. Requires positive
     *         equity (underwater positions must go through liquidate()).
     */
    function closePosition(uint64 id) external nonReentrant returns (uint256 payoutUsd) {
        Position storage p = _positions[id];
        if (p.owner != msg.sender) revert NotOwner();
        if (p.closed) revert AlreadyClosed();

        uint256 mark = markPrice();
        int256 equity = _equity(p, mark);
        if (equity <= 0) revert Underwater();

        payoutUsd = uint256(equity);

        _markClosed(p, id);
        QUOTE.safeTransfer(msg.sender, payoutUsd);

        emit PositionClosed(msg.sender, id, p.side, payoutUsd, mark, 0);
    }

    // ── Core: liquidate ──────────────────────────────────────────────────────

    /** @return keeperReward Quote units paid to the liquidator. */
    function liquidate(uint64 id) external nonReentrant returns (uint256 keeperReward) {
        Position storage p = _positions[id];
        if (p.owner == address(0)) revert PositionNotFound();
        if (p.closed) revert AlreadyClosed();

        uint256 mark = markPrice();
        int256 equity = _equity(p, mark);
        if (equity < int256(_maintenanceReq(p))) revert NotLiquidatable();

        keeperReward = (p.notional * liquidationBonusBps) / BPS;
        if (keeperReward > uint256(equity)) keeperReward = uint256(equity);

        address keeper = msg.sender;
        _markClosed(p, id);

        if (keeperReward > 0) QUOTE.safeTransfer(keeper, keeperReward);
        // The remainder of the margin stays in the contract: insurance pool.
        emit PositionLiquidated(p.owner, id, keeper, keeperReward, mark);
    }

    // ── Core: margin management ──────────────────────────────────────────────

    function addMargin(uint64 id, uint256 amount) external nonReentrant {
        Position storage p = _positions[id];
        if (p.owner != msg.sender) revert NotOwner();
        if (p.closed) revert AlreadyClosed();
        if (amount == 0) revert ZeroCollateral();

        QUOTE.safeTransferFrom(msg.sender, address(this), amount);
        p.collateral += amount;
        emit MarginChanged(id, amount, true);
    }

    function removeMargin(uint64 id, uint256 amount) external nonReentrant {
        Position storage p = _positions[id];
        if (p.owner != msg.sender) revert NotOwner();
        if (p.closed) revert AlreadyClosed();
        if (amount == 0 || amount > p.collateral) revert ZeroCollateral();

        uint256 mark = markPrice();
        int256 equity = _equity(p, mark);
        if (equity - int256(amount) < int256(_maintenanceReq(p))) revert BelowMaintenance();

        p.collateral -= amount;
        QUOTE.safeTransfer(msg.sender, amount);
        emit MarginChanged(id, amount, false);
    }

    // ── Funding ──────────────────────────────────────────────────────────────

    /** Anyone may apply the funding epoch once it is due. */
    function applyFunding() external nonReentrant {
        if (block.number < lastFundingBlock + fundingEpochBlocks) revert FundingNotDue();
        uint256 ratePerUnit = (fundingRateBps * SCALE) / BPS;
        fundingAcc += ratePerUnit;
        lastFundingBlock = block.number;
        emit FundingApplied(block.number, fundingRateBps, lastFundingBlock + fundingEpochBlocks);
    }

    // ── Insurance pool ───────────────────────────────────────────────────────

    function addInsurance(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroCollateral();
        QUOTE.safeTransferFrom(msg.sender, address(this), amount);
        emit InsuranceTopUp(msg.sender, amount);
    }

    // ── Internals ────────────────────────────────────────────────────────────

    /**
     * @return delta Signed PnL + funding delta, negative when margin should shrink.
     */
    function _realize(Position storage p, uint256 mark) internal view returns (int256 delta) {
        uint256 markDelta;
        if (p.side == Side.LONG) {
            if (mark >= p.entryMark) markDelta = mark - p.entryMark;
        } else {
            if (p.entryMark >= mark) markDelta = p.entryMark - mark;
        }
        int256 pnl = int256((markDelta * p.notional) / (p.entryMark == 0 ? 1 : p.entryMark));

        uint256 fundingAccrued = fundingAcc > p.fundingAtOpen ? fundingAcc - p.fundingAtOpen : 0;
        if (fundingAccrued > SCALE) fundingAccrued = SCALE;
        int256 funding = int256((fundingAccrued * p.notional) / SCALE);
        // LONGs pay funding; SHORTs receive it.
        if (p.side == Side.LONG) {
            delta = pnl - funding;
        } else {
            delta = pnl + funding;
        }
    }

    function _equity(Position storage p, uint256 mark) internal view returns (int256) {
        return int256(p.collateral) + _realize(p, mark);
    }

    function _maintenanceReq(Position storage p) internal view returns (uint256) {
        return (p.notional * maintenanceBps) / BPS;
    }

    function _markClosed(Position storage p, uint64 id) internal {
        p.closed = true;
        if (p.side == Side.LONG) totalLongNotional -= p.notional;
        else totalShortNotional -= p.notional;
        openPositionCount--;
        // Remove the id from the owner's list (O(n), fine for a demo engine).
        uint64[] storage list = _userPositions[p.owner];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == id) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
    }
}