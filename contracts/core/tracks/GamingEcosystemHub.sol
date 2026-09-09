// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IMockGameToken} from "../../interfaces/IMockGameToken.sol";
import {IMockGameItem} from "../../interfaces/IMockGameItem.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GamingEcosystemHub is IERC721Receiver, Ownable {
    // Custom Errors
    error ZeroAddress();
    error GatherCooldownActive();
    error ScoreTooLowForLootbox();
    error NotItemOwner();
    error NotApproved();
    error NotListed();
    error NotSeller();
    error CannotBuyOwnListing();
    error FeeTransferFailed();
    error SellerPaymentFailed();

    ICredXHub public immutable CREDX_HUB;
    IMockGameToken public gameToken;
    IMockGameItem public gameItem;

    // Constants
    uint256 public constant MIN_SCORE_LOOTBOX = 500;
    uint256 public constant SUPER_PRIME_SCORE = 750;
    uint256 public constant GATHER_COOLDOWN_BLOCKS = 7200; // ~1 day on Creditcoin (12s blocks)
    uint256 public constant BASE_GATHER_AMOUNT = 10 * 10**18;
    uint256 public constant MARKETPLACE_FEE_PERCENT = 2; // 2%

    // State
    mapping(address player => uint256 blockNumber) public lastGatherBlock;
    uint256 private _lootboxNonce;
    
    // Marketplace state
    struct Listing {
        address seller;
        uint256 price; // in gameToken
        bool active;
    }
    // tokenId => Listing
    mapping(uint256 tokenId => Listing listing) public listings;

    // Events
    event ResourcesGathered(address indexed player, uint256 amount);
    event LootboxOpened(address indexed player, uint256 tokenId, uint256 rarity);
    event ItemListed(address indexed seller, uint256 indexed tokenId, uint256 price);
    event ItemBought(address indexed buyer, address indexed seller, uint256 indexed tokenId, uint256 price, uint256 fee);
    event ListingCancelled(address indexed seller, uint256 indexed tokenId);

    constructor(
        address _credXHub,
        address _gameToken,
        address _gameItem
    ) Ownable(msg.sender) {
        if (_credXHub == address(0) || _gameToken == address(0) || _gameItem == address(0)) {
            revert ZeroAddress();
        }
        CREDX_HUB = ICredXHub(_credXHub);
        gameToken = IMockGameToken(_gameToken);
        gameItem = IMockGameItem(_gameItem);
    }

    // 1. Frictionless Daily Gathering (Pixels Style)
    function gatherResources() external {
        if (lastGatherBlock[msg.sender] != 0 && block.number < lastGatherBlock[msg.sender] + GATHER_COOLDOWN_BLOCKS) {
            revert GatherCooldownActive();
        }
        
        uint256 amount = BASE_GATHER_AMOUNT;
        
        uint256 creditScore = 0;
        try CREDX_HUB.getBorrowerProfile(msg.sender) returns (
            uint256 score, uint256, uint256, uint256, uint256, uint256
        ) {
            creditScore = score;
        } catch {}

        if (creditScore >= SUPER_PRIME_SCORE) {
            amount = BASE_GATHER_AMOUNT * 3; // 3x Multiplier for OG players
        }

        lastGatherBlock[msg.sender] = block.number;
        gameToken.mint(msg.sender, amount);

        emit ResourcesGathered(msg.sender, amount);
    }

    /**
     * @notice Opens a lootbox using an external entropy seed (e.g. from Chainlink VRF or Pyth Entropy).
     * @param entropySeed Cryptographic entropy seed provided by oracle or VRF callback.
     */
    function openLootboxWithEntropy(bytes32 entropySeed) public {
        (uint256 creditScore, , , , , ) = CREDX_HUB.getBorrowerProfile(msg.sender);
        if (creditScore < MIN_SCORE_LOOTBOX) {
            revert ScoreTooLowForLootbox();
        }

        _lootboxNonce++;
        // Combine VRF/entropy seed with user address and internal sequence nonce
        uint256 rand = uint256(keccak256(abi.encodePacked(entropySeed, msg.sender, _lootboxNonce))) % 100;
        
        uint256 rarity = 0; // Common
        
        if (creditScore >= SUPER_PRIME_SCORE) {
            // Boosted Drop Rates (e.g. 15% Legendary, 30% Rare, 55% Common)
            if (rand < 15) {
                rarity = 2; // Legendary
            } else if (rand < 45) {
                rarity = 1; // Rare
            }
        } else {
            // Standard Drop Rates (e.g. 5% Legendary, 15% Rare, 80% Common)
            if (rand < 5) {
                rarity = 2; // Legendary
            } else if (rand < 20) {
                rarity = 1; // Rare
            }
        }

        uint256 tokenId = gameItem.mint(msg.sender, rarity);
        emit LootboxOpened(msg.sender, tokenId, rarity);
    }

    /**
     * @notice Opens a lootbox with default protocol entropy.
     */
    function openLootbox() external {
        bytes32 seed = keccak256(abi.encodePacked(msg.sender, address(this), _lootboxNonce));
        openLootboxWithEntropy(seed);
    }

    // 3. Zero-Fee Marketplace (IMX Style)
    function listNFT(uint256 tokenId, uint256 price) external {
        if (gameItem.ownerOf(tokenId) != msg.sender) {
            revert NotItemOwner();
        }
        if (gameItem.getApproved(tokenId) != address(this) && !gameItem.isApprovedForAll(msg.sender, address(this))) {
            revert NotApproved();
        }

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit ItemListed(msg.sender, tokenId, price);
    }

    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        if (!listing.active) {
            revert NotListed();
        }
        if (listing.seller != msg.sender) {
            revert NotSeller();
        }
        
        listing.active = false;
        emit ListingCancelled(msg.sender, tokenId);
    }

    function buyNFT(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        if (!listing.active) {
            revert NotListed();
        }
        if (listing.seller == msg.sender) {
            revert CannotBuyOwnListing();
        }

        uint256 price = listing.price;
        address seller = listing.seller;
        
        listing.active = false;

        uint256 creditScore = 0;
        try CREDX_HUB.getBorrowerProfile(msg.sender) returns (
            uint256 score, uint256, uint256, uint256, uint256, uint256
        ) {
            creditScore = score;
        } catch {}

        uint256 fee = 0;
        if (creditScore < SUPER_PRIME_SCORE) {
            // Standard fee
            fee = (price * MARKETPLACE_FEE_PERCENT) / 100;
        }

        uint256 sellerAmount = price - fee;

        // Transfer funds
        // Need to transfer fee to the hub (address(this)) and sellerAmount to the seller
        if (fee > 0) {
            if (!gameToken.transferFrom(msg.sender, address(this), fee)) {
                revert FeeTransferFailed();
            }
        }
        if (!gameToken.transferFrom(msg.sender, seller, sellerAmount)) {
            revert SellerPaymentFailed();
        }

        // Transfer NFT
        gameItem.safeTransferFrom(seller, msg.sender, tokenId);

        emit ItemBought(msg.sender, seller, tokenId, price, fee);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
