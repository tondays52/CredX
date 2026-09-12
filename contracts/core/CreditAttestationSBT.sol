// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICredXHub} from "../interfaces/ICredXHub.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title CreditAttestationSBT
 * @notice Soulbound Token (SBT) that proves a borrower's credit tier on-chain
 *         without revealing their detailed transaction history.
 * 
 * @dev A REAL ERC-721 (supports ERC165, implements balanceOf/ownerOf/Transfer events) with
 *      transfers and approvals disabled (soulbound). Inspired by Vitalik Buterin's SBT
 *      proposal (2022) and selective disclosure research (2025).
 *      
 *      Users can mint a non-transferable attestation proving:
 *        "This wallet has CTS >= [tier threshold] as of block [X]"
 *      
 *      This enables privacy-preserving credit proof for:
 *        - Cross-protocol reputation portability
 *        - Regulatory-compliant selective disclosure (GDPR compatible)
 *        - Trust signaling without raw data exposure
 */
contract CreditAttestationSBT is ERC721 {
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
    //  Custom Errors
    // ═══════════════════════════════════════════════════════════════════════
    error ZeroAddress();
    error OnlyOwner();
    error AlreadyHoldsAttestation();
    error InsufficientCreditHistory();
    error NoAttestationFound();
    error AlreadyRevoked();
    error NonTransferable();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _credXHub) ERC721("CredX Credit Attestation", "CX-SBT") {
        if (_credXHub == address(0)) revert ZeroAddress();
        owner = msg.sender;
        credXHub = ICredXHub(_credXHub);
    }

    /**
     * @notice Mint a Soulbound Credit Attestation Token.
     * @dev Proves "I have CTS >= [tier threshold]".
     */
    function mintAttestation() external returns (uint256 tokenId) {
        if (holderTokenId[msg.sender] != 0) revert AlreadyHoldsAttestation();

        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        if (creditScore < 300) revert InsufficientCreditHistory();

        CreditTier tier = _scoreToCreditTier(creditScore);
        uint256 minimumScore = _tierToMinimumScore(tier);

        tokenId = nextTokenId++;

        // Privacy commitment: proves exact score without on-chain exposure, bound to canonical block height
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

        _mint(msg.sender, tokenId);

        emit AttestationMinted(tokenId, msg.sender, tier, minimumScore, commitmentHash);

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
        // Deterministic commitment hash bound to block.number and tokenId
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
        _burn(tokenId);
        emit AttestationRevoked(tokenId, holder);
    }

    /**
     * @notice Verify that an address holds a valid attestation at or above a given tier.
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
     */
    function getAttestation(address holder) external view returns (Attestation memory) {
        if (holder == address(0)) revert ZeroAddress();
        uint256 tokenId = holderTokenId[holder];
        if (tokenId == 0) revert NoAttestationFound();
        return attestations[tokenId];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Soulbound: Prevent Transfers and Approvals
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @dev Overridden ERC721 hook: only allow minting (from == 0) and burning (to == 0).
     *      Any real transfer between addresses is blocked.
     */
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert NonTransferable();
        }
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public virtual override {
        revert NonTransferable();
    }

    function setApprovalForAll(address, bool) public virtual override {
        revert NonTransferable();
    }

    /**
     * @notice Minimal metadata URI so wallet integrations render the attestation.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(string.concat(
                '{"name":"CredX Credit Attestation #',
                uint256ToString(tokenId),
                '","description":"Nontransferable Creditcoin cross-chain credit attestation","attributes":[{"trait_type":"tier","value":"',
                tierToString(attestations[tokenId].tier),
                '"}]}'
            )))
        );
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

    function tierToString(CreditTier tier) internal pure returns (string memory) {
        if (tier == CreditTier.SUPER_PRIME) return "SUPER_PRIME";
        if (tier == CreditTier.PRIME) return "PRIME";
        if (tier == CreditTier.NEAR_PRIME) return "NEAR_PRIME";
        return "SUBPRIME";
    }

    function uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

/**
 * @dev Minimal base64 encoder for the inline SBT metadata URI (no external dependency).
 */
library Base64 {
    bytes internal constant TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        string memory result = new string(4 * ((data.length + 2) / 3));
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 a = uint8(data[i]);
            uint256 b = i + 1 < data.length ? uint8(data[i + 1]) : 0;
            uint256 c = i + 2 < data.length ? uint8(data[i + 2]) : 0;
            uint256 triple = (a << 16) | (b << 8) | c;

            bytes(result)[resultIndex++] = TABLE[(triple >> 18) & 0x3F];
            bytes(result)[resultIndex++] = TABLE[(triple >> 12) & 0x3F];
            bytes(result)[resultIndex++] = i + 1 < data.length ? TABLE[(triple >> 6) & 0x3F] : bytes1("=");
            bytes(result)[resultIndex++] = i + 2 < data.length ? TABLE[triple & 0x3F] : bytes1("=");
        }
        return result;
    }
}