// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    error ZeroAddress();

    event Minted(address indexed to, uint256 indexed tokenId);

    uint256 private _nextTokenId;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {
        _nextTokenId = 0;
    }

    function mint(address to) public returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        emit Minted(to, tokenId);
        return tokenId;
    }
}
