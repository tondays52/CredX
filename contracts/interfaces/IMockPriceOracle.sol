// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IMockPriceOracle {
    /**
     * @notice Returns the latest price of the asset.
     * @return price The latest price.
     * @return decimals The number of decimals the price is scaled by.
     */
    function getLatestPrice() external view returns (uint256 price, uint8 decimals);
}
