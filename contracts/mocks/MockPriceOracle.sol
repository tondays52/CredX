// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IMockPriceOracle} from "../interfaces/IMockPriceOracle.sol";

contract MockPriceOracle is IMockPriceOracle {
    uint256 private _currentPrice;
    uint8 private _currentDecimals;

    event PriceUpdated(uint256 price);

    constructor(uint256 initialPrice, uint8 decimals) {
        _currentPrice = initialPrice;
        _currentDecimals = decimals;
    }

    function setPrice(uint256 price) external {
        _currentPrice = price;
        emit PriceUpdated(price);
    }

    function getLatestPrice() external view override returns (uint256 price, uint8 decimals) {
        return (_currentPrice, _currentDecimals);
    }
}
