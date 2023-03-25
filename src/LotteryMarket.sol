// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./external/IMarket.sol";
import "./external/IMarketManagerModule.sol";

contract LotteryMarket is IMarket {

    IMarketManagerModule synthetix;
    uint128 public marketId;

    uint256 public jackpot = 1000 ether;
    uint256 public ticketCost = 1 ether;

    uint256 public feePercent = 0.01 ether;

    uint256 private currentDrawEpoch;
    bool private isDrawing;

    mapping(uint256 => mapping(uint256 => address[])) ticketBuckets;

    constructor(IMarketManagerModule _synthetix, uint256 _jackpot, uint256 _ticketCost, uint256 _feePercent) {
        synthetix = _synthetix;
        jackpot = _jackpot;
        ticketCost = _ticketCost;
        feePercent = _feePercent;

        marketId = synthetix.registerMarket(address(this));
    }

    function buy(address beneficary, uint lotteryNumber) external {
        synthetix.getUSDToken().transferFrom(msg.sender, ticketCost);
        ticketBuckets[currentDrawEpoch][lotteryNumber % _bucketCount()].push(beneficary);
    }

    function startDraw() public {
        currentDrawEpoch++;
        isDrawing = true;
    }

    function finishDraw() public {

    }

    function name(uint128 _marketId) external override view returns (string memory n) {
        if (_marketId == marketId) {
            n = "Lottery (ticket price = , jackpot = )";
        }
    }

    function reportedDebt(uint128) external override pure returns (uint256) {
        return 0;
    }

    function locked(uint128 _marketId) external override view returns (uint256 l) {
        if (_marketId == marketId) {
            // all collateral is locked during the draw
            if (isDrawing) {
                l = type(uint).max;
            }
        }
        return 0;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }

    function _bucketCount() internal view returns (uint256) {
        uint256 baseBuckets = jackpot / ticketCost;
        return baseBuckets + baseBuckets * feePercent;
    }
}
