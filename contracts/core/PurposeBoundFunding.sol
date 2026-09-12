// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPurposeBoundFunding, PurposeCode, PurposeRecord} from "../interfaces/IPurposeBoundFunding.sol";
import {ICredXHub} from "../interfaces/ICredXHub.sol";
import {IAttestationVerifier} from "../interfaces/IAttestationVerifier.sol";
import {CreditScoreEngine} from "./CreditScoreEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

uint256 constant PB_BPS_DIVISOR = 10000;
uint256 constant PB_LOAN_DURATION_BLOCKS = 216000; // ~30 days at 12s/block
uint256 constant PB_BLOCKS_PER_YEAR = 2628000; // ~365 days at 12s/block
uint256 constant PB_INTEREST_DENOMINATOR = PB_BPS_DIVISOR * PB_BLOCKS_PER_YEAR;
uint256 constant PB_CTC_PRICE_DEFAULT_USD = 2 * 10**18; // 1 CTC = $2.00 USD (demo pricing, owner-updatable)

/**
 * @title PurposeBoundFunding
 * @notice Purpose-bound on-chain funding facility for Real-World Assets (RWA).
 * @dev A borrower opens a purpose record and locks native collateral. Until an
 *      attested usage receipt is verified, disbursements can ONLY move to an
 *      allowlisted recipient (invoice counterparty, equipment vendor, payroll
 *      roster) — the borrower cannot divert credit line money to a free address.
 *      An attested-usage path unlocks borrower tranches, and the covenant
 *      deadswitch freezes the whole facility on proven breach (mirrors the
 *      UndercollateralizedLendingPool guardrails while enforcing purpose).
 */
contract PurposeBoundFunding is IPurposeBoundFunding, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    IERC20 public liquidityToken; // cUSD settlement token
    ICredXHub public credXHub;
    CreditScoreEngine public scoreEngine;
    IAttestationVerifier public verifier;
    address public owner;
    address public treasury;

    uint256 public ctcPriceUSD;
    uint256 public nextRecordId = 1;
    uint256 public totalLiquidityUSD;
    uint256 public totalBorrowedUSD;
    uint256 public realizedLossUSD;

    mapping(address lender => uint256 balanceUSD) public lenderBalances;
    mapping(uint256 recordId => PurposeRecord record) public records;
    mapping(address borrower => uint256[] ids) public userRecords;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _tokenAddress, address _credXHub, address _scoreEngine, address _verifier) {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (_credXHub == address(0)) revert ZeroAddress();
        if (_scoreEngine == address(0)) revert ZeroAddress();
        if (_verifier == address(0)) revert ZeroAddress();
        owner = msg.sender;
        treasury = msg.sender;
        ctcPriceUSD = PB_CTC_PRICE_DEFAULT_USD;
        liquidityToken = IERC20(_tokenAddress);
        credXHub = ICredXHub(_credXHub);
        scoreEngine = CreditScoreEngine(_scoreEngine);
        verifier = IAttestationVerifier(_verifier);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    function setCtcPriceUSD(uint256 _price) external onlyOwner {
        if (_price == 0) revert InvalidAmount();
        ctcPriceUSD = _price;
    }

    /**
     * @notice Lenders deposit settlement tokens (cUSD) to fund purpose-bound credit.
     */
    function depositLiquidity(uint256 amountUSD) external override nonReentrant {
        if (amountUSD == 0) revert InvalidAmount();
        lenderBalances[msg.sender] += amountUSD;
        totalLiquidityUSD += amountUSD;
        liquidityToken.safeTransferFrom(msg.sender, address(this), amountUSD);
        emit LiquidityDeposited(msg.sender, amountUSD);
    }

    /**
     * @notice Lenders withdraw unused liquidity.
     */
    function withdrawLiquidity(uint256 amountUSD) external override nonReentrant {
        if (lenderBalances[msg.sender] < amountUSD) revert InvalidAmount();
        if (totalLiquidityUSD - totalBorrowedUSD < amountUSD) revert InsufficientPoolLiquidity();
        lenderBalances[msg.sender] -= amountUSD;
        totalLiquidityUSD -= amountUSD;
        liquidityToken.safeTransfer(msg.sender, amountUSD);
        emit LiquidityWithdrawn(msg.sender, amountUSD);
    }

    /**
     * @notice Open a purpose-bound credit record, locking native collateral.
     * @param purposeCode Declared purpose for the funds (cannot be changed).
     * @param allowlistedRecipient The only address entitled to receive funds before attested usage.
     * @param covenantHash keccak256 context binding purpose terms to this record.
     * @param approvedUSD Approved credit amount (18 decimals).
     */
    function fundPurpose(
        PurposeCode purposeCode,
        address allowlistedRecipient,
        bytes32 covenantHash,
        uint256 approvedUSD
    ) external payable override nonReentrant returns (uint256 recordId) {
        if (approvedUSD == 0) revert InvalidAmount();
        if (allowlistedRecipient == address(0)) revert ZeroAddress();
        if (totalLiquidityUSD - totalBorrowedUSD < approvedUSD) revert InsufficientPoolLiquidity();

        (
            uint256 creditScore,
            ,
            ,
            uint256 maxCreditLineUSD,
            uint256 collateralRatioBps,

        ) = credXHub.getBorrowerProfile(msg.sender);

        if (approvedUSD > maxCreditLineUSD) revert InvalidAmount();

        uint256 requiredCollateralCTC = (approvedUSD * collateralRatioBps * 10**18) / (PB_BPS_DIVISOR * ctcPriceUSD);
        if (msg.value < requiredCollateralCTC) revert InvalidAmount();

        uint256 interestRateBps = scoreEngine.getInterestRate(creditScore);
        uint256 dueBlock = block.number + PB_LOAN_DURATION_BLOCKS;

        recordId = nextRecordId++;
        records[recordId] = PurposeRecord({
            recordId: recordId,
            borrower: msg.sender,
            allowlistedRecipient: allowlistedRecipient,
            purposeCode: purposeCode,
            covenantHash: covenantHash,
            approvedUSD: approvedUSD,
            drawnUSD: 0,
            collateralCTC: requiredCollateralCTC,
            borrowedAtBlock: block.number,
            dueBlock: dueBlock,
            interestRateBps: interestRateBps,
            isFrozen: false,
            isSettled: false
        });

        userRecords[msg.sender].push(recordId);
        totalBorrowedUSD += approvedUSD;

        if (msg.value > requiredCollateralCTC) {
            payable(msg.sender).sendValue(msg.value - requiredCollateralCTC);
        }

        emit PurposeFunded(
            recordId,
            msg.sender,
            purposeCode,
            allowlistedRecipient,
            covenantHash,
            approvedUSD,
            requiredCollateralCTC,
            dueBlock
        );
    }

    /**
     * @notice Disburse purpose-bound funds to the allowlisted recipient only.
     * @dev The borrower cannot route funds to themselves or any other address:
     *      the recipient is bound at funding time.
     */
    function disburseToRecipient(uint256 recordId, uint256 amountUSD) external override nonReentrant {
        PurposeRecord storage rec = records[recordId];
        _ensureActive(rec);
        if (msg.sender != rec.borrower) revert OnlyBorrower();
        if (rec.drawnUSD + amountUSD > rec.approvedUSD) revert DrawExceedsApproval();

        rec.drawnUSD += amountUSD;
        liquidityToken.safeTransfer(rec.allowlistedRecipient, amountUSD);
        emit PurposeDisbursed(recordId, rec.allowlistedRecipient, amountUSD);
    }

    /**
     * @notice Disburse a tranche to the borrower only after an attested usage
     *         receipt proves the purpose was actually rendered on the source chain.
     * @param usageProof Merkle/continuity proof of the usage transaction.
     * @param expectedEventSignature Optional Topic0 to bind the proof to a specific event (0 to skip).
     */
    function disburseAttestedTranche(
        uint256 recordId,
        uint256 amountUSD,
        IAttestationVerifier.EventProof calldata usageProof,
        bytes32 expectedEventSignature
    ) external override nonReentrant {
        PurposeRecord storage rec = records[recordId];
        _ensureActive(rec);
        if (msg.sender != rec.borrower) revert OnlyBorrower();
        if (rec.drawnUSD + amountUSD > rec.approvedUSD) revert DrawExceedsApproval();

        IAttestationVerifier.AttestationResult memory result = verifier.verifyEventProof(usageProof);
        if (!result.isValid) revert ProofRejected();
        if (expectedEventSignature != bytes32(0) && result.eventSignature != expectedEventSignature) {
            revert WrongEventSignature();
        }

        rec.drawnUSD += amountUSD;
        liquidityToken.safeTransfer(rec.borrower, amountUSD);
        emit PurposeUsageAttested(recordId, usageProof.txHash, amountUSD);
    }

    /**
     * @notice Repay the principal plus block-proportional interest and unlock collateral.
     */
    function settleRecord(uint256 recordId, uint256 amountUSD) external override nonReentrant {
        PurposeRecord storage rec = records[recordId];
        if (rec.isSettled) revert AlreadySettled();
        if (msg.sender != rec.borrower) revert OnlyBorrower();

        uint256 blocksElapsed = block.number - rec.borrowedAtBlock;
        uint256 interestUSD = (rec.approvedUSD * rec.interestRateBps * blocksElapsed) / PB_INTEREST_DENOMINATOR;
        uint256 totalDueUSD = rec.approvedUSD + interestUSD;

        if (amountUSD < totalDueUSD) revert RepaymentInsufficient();

        liquidityToken.safeTransferFrom(msg.sender, address(this), totalDueUSD);
        rec.isSettled = true;
        totalBorrowedUSD -= rec.approvedUSD;

        uint256 refundCollateral = rec.collateralCTC;
        rec.collateralCTC = 0;
        payable(rec.borrower).sendValue(refundCollateral);

        emit PurposeSettled(recordId, rec.borrower, totalDueUSD);
    }

    /**
     * @notice Covenant deadswitch: freeze a record on proven breach so no further
     *         purpose-bound disbursement can occur.
     */
    function freezeForBreach(uint256 recordId, bytes32 evidenceProofRoot, string calldata reason)
        external
        override
        nonReentrant
        onlyOwner
    {
        PurposeRecord storage rec = records[recordId];
        _ensureExistsNotSettled(rec);
        rec.isFrozen = true;
        emit PurposeFrozen(recordId, evidenceProofRoot, reason);
    }

    function restoreRecord(uint256 recordId) external override nonReentrant onlyOwner {
        PurposeRecord storage rec = records[recordId];
        _ensureExistsNotSettled(rec);
        rec.isFrozen = false;
        emit PurposeRestored(recordId);
    }

    function _ensureExistsNotSettled(PurposeRecord storage rec) internal view {
        if (rec.borrower == address(0)) revert RecordNotActive();
        if (rec.isSettled) revert AlreadySettled();
    }

    function _ensureActive(PurposeRecord storage rec) internal view {
        if (rec.borrower == address(0)) revert RecordNotActive();
        if (rec.isSettled) revert AlreadySettled();
        if (rec.isFrozen) revert RecordFrozen();
    }

    function getUserRecords(address user) external view override returns (uint256[] memory) {
        if (user == address(0)) revert ZeroAddress();
        return userRecords[user];
    }

    function getRecord(uint256 recordId) external view override returns (PurposeRecord memory) {
        return records[recordId];
    }
}