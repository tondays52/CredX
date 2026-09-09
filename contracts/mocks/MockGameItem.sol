// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockGameItem is ERC721, Ownable {
    error ZeroAddress();

    event ItemMinted(address indexed to, uint256 indexed tokenId, uint256 rarity);

    uint256 private _nextTokenId;

    // tokenId => rarity (0=Common, 1=Rare, 2=Legendary)
    mapping(uint256 tokenId => uint256 rarity) public itemRarity;

    constructor() ERC721("Gaming Loot", "LOOT") Ownable(msg.sender) {
        _nextTokenId = 0;
    }

    function mint(
        address to,
        uint256 rarity
    ) external onlyOwner returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        uint256 tokenId = _nextTokenId++;
        itemRarity[tokenId] = rarity;
        _mint(to, tokenId);
        emit ItemMinted(to, tokenId, rarity);
        return tokenId;
    }
}
