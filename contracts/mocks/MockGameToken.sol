// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockGameToken is ERC20, Ownable {
    constructor() ERC20("Pixels Wood", "WOOD") Ownable(msg.sender) {
        // empty block
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address: to");
        _mint(to, amount);
    }
}
