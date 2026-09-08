// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {ICredXHub} from "../interfaces/ICredXHub.sol";

/**
 * @title CreditAttestationSBT
 * @notice Soulbound Token (SBT) that proves a borrower's credit tier on-chain
 *         without revealing their detailed transaction history.
 * 
 * @dev Implements ERC-721 metadata interface but prevents transfers (soulbound).
 *      Inspired by Vitalik Buterin's SBT proposal (2022) and selective disclosure research (2025).
 *      
 *      Users can mint a non-transferable attestation proving:
 *        "This wallet has CTS >= [tier threshold] as of block [X]"
 *      
 *      This enables privacy-preserving credit proof for:
 *        - Cross-protocol reputation portability
 *        - Regulatory-compliant selective disclosure (GDPR compatible)
 *        - Trust signaling without raw data exposure
 */
contract CreditAttestationSBT {
    string public name = "CredX Credit Attestation";
    string public symbol = "CX-SBT";

    ICredXHub public credXHub;
    address public owner;

    uint256 public nextTokenId = 1;

    enum CreditTier {
        SUBPRIME,      // 300-499
        NEAR_PRIME,    // 500-649  
        PRIME,         // 650-779
        SUPER_PRIME    // 780-850
    }

    struct Attestation {
        uint256 tokenId;
        address holder;
        CreditTier tier;
        uint256 minimumScore;     // The minimum score threshold proved
        uint256 attestedBlock;    // Block number when minted (canonical, immune to miner manipulation)
        bytes32 commitmentHash;   // Hash commitment of the exact score (privacy-preserving)
        bool isValid;             // Can be revoked if score drops
    }

    mapping(uint256 tokenId => Attestation attestation) public attestations;
    mapping(address holder => uint256 tokenId) public holderTokenId;  // One SBT per address

    event AttestationMinted(
        uint256 indexed tokenId,
        address indexed holder,
        CreditTier tier,
        uint256 minimumScore,
        bytes32 commitmentHash
    );

    event AttestationRevoked(uint256 indexed tokenId, address indexed holder);
    event AttestationRefreshed(uint256 indexed tokenId, CreditTier newTier, uint256 newMinimumScore);

    // ═══════════════════════════════════════════════════════════════════════
    //  Custom Errors (Gas Optimization & Strong Typing)
    // ═══════════════════════════════════════════════════════════════════════
    error ZeroAddress();
    error OnlyOwner();
    error AlreadyHoldsAttestation();
    error InsufficientCreditHistory();
    error NoAttestationFound();
    error AlreadyRevoked();
    error NonTransferable();

    // Minimal ERC-721 events for wallet compatibility
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _credXHub) {
        if (_credXHub == address(0)) revert ZeroAddress();
        owner = msg.sender;
        credXHub = ICredXHub(_credXHub);
    }

    /**
     * @notice Mint a Soulbound Credit Attestation Token.
     * @dev Proves "I have CTS >= [tier threshold]" without revealing exact score.
     */
    function mintAttestation() external returns (uint256 tokenId) {
        if (holderTokenId[msg.sender] != 0) revert AlreadyHoldsAttestation();

        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        if (creditScore < 300) revert InsufficientCreditHistory();

        CreditTier tier = _scoreToCreditTier(creditScore);
        uint256 minimumScore = _tierToMinimumScore(tier);

        tokenId = nextTokenId++;

        // Privacy commitment: proves exact score without on-chain exposure, bound to canonical block height (immune to timestamp manipulation)
        bytes32 commitmentHash = keccak256(abi.encodePacked(msg.sender, creditScore, block.number, tokenId));

        attestations[tokenId] = Attestation({
            tokenId: tokenId,
            holder: msg.sender,
            tier: tier,
            minimumScore: minimumScore,
            attestedBlock: block.number,
            commitmentHash: commitmentHash,
            isValid: true
        });
        holderTokenId[msg.sender] = tokenId;

        emit AttestationMinted(tokenId, msg.sender, tier, minimumScore, commitmentHash);
        emit Transfer(address(0), msg.sender, tokenId); // ERC-721 compatible mint event

        return tokenId;
    }

    /**
     * @notice Refresh your attestation with your current credit score.
     */
    function refreshAttestation() external {
        uint256 tokenId = holderTokenId[msg.sender];
        if (tokenId == 0) revert NoAttestationFound();

        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        CreditTier tier = _scoreToCreditTier(creditScore);
        uint256 minimumScore = _tierToMinimumScore(tier);

        Attestation storage att = attestations[tokenId];
        att.tier = tier;
        att.minimumScore = minimumScore;
        att.attestedBlock = block.number;
        // Deterministic commitment hash bound to block.number and tokenId (immune to miner timestamp drift)
        att.commitmentHash = keccak256(abi.encodePacked(msg.sender, creditScore, block.number, tokenId));
        att.isValid = true;

        emit AttestationRefreshed(tokenId, tier, minimumScore);
    }

    /**
     * @notice Revoke an attestation if a borrower defaults or credentials are invalidated.
     * @param holder The address whose attestation is being revoked.
     */
    function revokeAttestation(address holder) external onlyOwner {
        if (holder == address(0)) revert ZeroAddress();
        uint256 tokenId = holderTokenId[holder];
        if (tokenId == 0) revert NoAttestationFound();
        if (!attestations[tokenId].isValid) revert AlreadyRevoked();

        attestations[tokenId].isValid = false;
        emit AttestationRevoked(tokenId, holder);
    }

    /**
     * @notice Verify that an address holds a valid attestation at or above a given tier.
     * @param holder The address to check.
     * @param requiredTier The minimum tier required.
     */
    function verifyAttestation(address holder, CreditTier requiredTier) external view returns (bool) {
        if (holder == address(0)) return false;
        uint256 tokenId = holderTokenId[holder];
        if (tokenId == 0) return false;

        Attestation memory att = attestations[tokenId];
        if (!att.isValid) return false;

        return uint8(att.tier) >= uint8(requiredTier);
    }

    /**
     * @notice Get the attestation details for a holder.
     * @param holder The address of the attestation holder.
     */
    function getAttestation(address holder) external view returns (Attestation memory) {
        if (holder == address(0)) revert ZeroAddress();
        uint256 tokenId = holderTokenId[holder];
        if (tokenId == 0) revert NoAttestationFound();
        return attestations[tokenId];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Soulbound: Prevent Transfers
    // ═══════════════════════════════════════════════════════════════════════

    function transferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }

    function approve(address, uint256) external pure {
        revert NonTransferable();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Internals
    // ═══════════════════════════════════════════════════════════════════════

    function _scoreToCreditTier(uint256 score) internal pure returns (CreditTier) {
        if (score >= 780) return CreditTier.SUPER_PRIME;
        if (score >= 650) return CreditTier.PRIME;
        if (score >= 500) return CreditTier.NEAR_PRIME;
        return CreditTier.SUBPRIME;
    }

    function _tierToMinimumScore(CreditTier tier) internal pure returns (uint256) {
        if (tier == CreditTier.SUPER_PRIME) return 780;
        if (tier == CreditTier.PRIME) return 650;
        if (tier == CreditTier.NEAR_PRIME) return 500;
        return 300;
    }
}
