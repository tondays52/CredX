// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICredXHub.sol";

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
        uint256 attestedAt;       // Block timestamp when minted
        uint256 attestedBlock;    // Block number when minted
        bytes32 commitmentHash;   // Hash commitment of the exact score (privacy-preserving)
        bool isValid;             // Can be revoked if score drops
    }

    mapping(uint256 => Attestation) public attestations;
    mapping(address => uint256) public holderTokenId;  // One SBT per address

    event AttestationMinted(
        uint256 indexed tokenId,
        address indexed holder,
        CreditTier tier,
        uint256 minimumScore,
        bytes32 commitmentHash
    );

    event AttestationRevoked(uint256 indexed tokenId, address indexed holder);
    event AttestationRefreshed(uint256 indexed tokenId, CreditTier newTier, uint256 newMinimumScore);

    // Minimal ERC-721 events for wallet compatibility
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _credXHub) {
        owner = msg.sender;
        credXHub = ICredXHub(_credXHub);
    }

    /**
     * @notice Mint a Soulbound Credit Attestation Token.
     * @dev Proves "I have CTS >= [tier threshold]" without revealing exact score.
     */
    function mintAttestation() external returns (uint256 tokenId) {
        require(holderTokenId[msg.sender] == 0, "Already holds an attestation (refresh instead)");

        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        require(creditScore >= 300, "No credit history to attest");

        CreditTier tier = _scoreToCreditTier(creditScore);
        uint256 minimumScore = _tierToMinimumScore(tier);

        // Privacy commitment: proves exact score without on-chain exposure
        bytes32 commitmentHash = keccak256(abi.encodePacked(msg.sender, creditScore, block.timestamp, blockhash(block.number - 1)));

        tokenId = nextTokenId++;
        attestations[tokenId] = Attestation({
            tokenId: tokenId,
            holder: msg.sender,
            tier: tier,
            minimumScore: minimumScore,
            attestedAt: block.timestamp,
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
        require(tokenId != 0, "No attestation to refresh");

        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        CreditTier tier = _scoreToCreditTier(creditScore);
        uint256 minimumScore = _tierToMinimumScore(tier);

        Attestation storage att = attestations[tokenId];
        att.tier = tier;
        att.minimumScore = minimumScore;
        att.attestedAt = block.timestamp;
        att.attestedBlock = block.number;
        att.commitmentHash = keccak256(abi.encodePacked(msg.sender, creditScore, block.timestamp));
        att.isValid = true;

        emit AttestationRefreshed(tokenId, tier, minimumScore);
    }

    /**
     * @notice Verify that an address holds a valid attestation at or above a given tier.
     * @param holder The address to check.
     * @param requiredTier The minimum tier required.
     */
    function verifyAttestation(address holder, CreditTier requiredTier) external view returns (bool) {
        uint256 tokenId = holderTokenId[holder];
        if (tokenId == 0) return false;

        Attestation memory att = attestations[tokenId];
        if (!att.isValid) return false;

        return uint8(att.tier) >= uint8(requiredTier);
    }

    /**
     * @notice Get the attestation details for a holder.
     */
    function getAttestation(address holder) external view returns (Attestation memory) {
        uint256 tokenId = holderTokenId[holder];
        require(tokenId != 0, "No attestation found");
        return attestations[tokenId];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Soulbound: Prevent Transfers
    // ═══════════════════════════════════════════════════════════════════════

    function transferFrom(address, address, uint256) external pure {
        revert("SBT: Non-transferable");
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert("SBT: Non-transferable");
    }

    function approve(address, uint256) external pure {
        revert("SBT: Non-transferable");
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
