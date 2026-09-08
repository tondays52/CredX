// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockGameItem is ERC721, Ownable {
    uint256 private _nextTokenId;

    // tokenId => rarity (0=Common, 1=Rare, 2=Legendary)
    mapping(uint256 => uint256) public itemRarity;

    constructor() ERC721("Gaming Loot", "LOOT") Ownable(msg.sender) {}

    function mint(
        address to,
        uint256 rarity
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        itemRarity[tokenId] = rarity;
        _mint(to, tokenId);
        return tokenId;
    }
}
