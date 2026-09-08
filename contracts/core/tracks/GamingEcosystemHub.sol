// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICredXHub} from "../../interfaces/ICredXHub.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Interfaces for our mocks since this is just a hub
interface IMockGameToken is IERC20 {
    function mint(address to, uint256 amount) external;
}
interface IMockGameItem is IERC721 {
    function mint(address to, uint256 rarity) external returns (uint256);
}

contract GamingEcosystemHub is IERC721Receiver, Ownable {
    ICredXHub public immutable credXHub;
    IMockGameToken public gameToken;
    IMockGameItem public gameItem;

    // Constants
    uint256 public constant MIN_SCORE_LOOTBOX = 500;
    uint256 public constant SUPER_PRIME_SCORE = 750;
    uint256 public constant GATHER_COOLDOWN = 1 days;
    uint256 public constant BASE_GATHER_AMOUNT = 10 * 10**18;
    uint256 public constant MARKETPLACE_FEE_PERCENT = 2; // 2%

    // State
    mapping(address player => uint256 timestamp) public lastGatherTime;
    
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
        require(_credXHub != address(0), "Zero address: credXHub");
        require(_gameToken != address(0), "Zero address: gameToken");
        require(_gameItem != address(0), "Zero address: gameItem");
        credXHub = ICredXHub(_credXHub);
        gameToken = IMockGameToken(_gameToken);
        gameItem = IMockGameItem(_gameItem);
    }

    // 1. Frictionless Daily Gathering (Pixels Style)
    function gatherResources() external {
        require(block.timestamp >= lastGatherTime[msg.sender] + GATHER_COOLDOWN, "Gather cooldown active");
        
        uint256 amount = BASE_GATHER_AMOUNT;
        
        uint256 creditScore = 0;
        try credXHub.getBorrowerProfile(msg.sender) returns (
            uint256 score, uint256, uint256, uint256, uint256, uint256
        ) {
            creditScore = score;
        } catch {}

        if (creditScore >= SUPER_PRIME_SCORE) {
            amount = BASE_GATHER_AMOUNT * 3; // 3x Multiplier for OG players
        }

        lastGatherTime[msg.sender] = block.timestamp;
        gameToken.mint(msg.sender, amount);

        emit ResourcesGathered(msg.sender, amount);
    }

    // 2. Anti-Sybil Fair Lootbox
    function openLootbox() external {
        (uint256 creditScore, , , , , ) = credXHub.getBorrowerProfile(msg.sender);
        require(creditScore >= MIN_SCORE_LOOTBOX, "Score too low for lootbox");

        // Pseudorandom rarity
        uint256 rand = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender))) % 100;
        
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

    // 3. Zero-Fee Marketplace (IMX Style)
    function listNFT(uint256 tokenId, uint256 price) external {
        require(gameItem.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(gameItem.getApproved(tokenId) == address(this) || gameItem.isApprovedForAll(msg.sender, address(this)), "Not approved");

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit ItemListed(msg.sender, tokenId, price);
    }

    function cancelListing(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(listing.seller == msg.sender, "Not the seller");
        
        listing.active = false;
        emit ListingCancelled(msg.sender, tokenId);
    }

    function buyNFT(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed");
        require(listing.seller != msg.sender, "Cannot buy own listing");

        uint256 price = listing.price;
        address seller = listing.seller;
        
        listing.active = false;

        uint256 creditScore = 0;
        try credXHub.getBorrowerProfile(msg.sender) returns (
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
            require(gameToken.transferFrom(msg.sender, address(this), fee), "Fee transfer failed");
        }
        require(gameToken.transferFrom(msg.sender, seller, sellerAmount), "Seller payment failed");

        // Transfer NFT
        gameItem.safeTransferFrom(seller, msg.sender, tokenId);

        emit ItemBought(msg.sender, seller, tokenId, price, fee);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
