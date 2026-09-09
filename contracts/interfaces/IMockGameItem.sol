// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IMockGameItem is IERC721 {
    function mint(address to, uint256 rarity) external returns (uint256);
}
