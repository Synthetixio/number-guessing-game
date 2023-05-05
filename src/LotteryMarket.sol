// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./external/IMarket.sol";
import "./external/ISynthetixCore.sol";

import "lib/forge-std/src/interfaces/IERC20.sol";
import "lib/chainlink/contracts/src/v0.8/VRFV2WrapperConsumerBase.sol";

contract LotteryMarket is VRFV2WrapperConsumerBase, IMarket {
    event LotteryRegistered(uint128 indexed marketId);

    /**
     * If too many people guess the same number, the contract could run out of money if that number is drawn.
     * To prevent this from happening, an error is thrown if there are too many tickets drawn for a single number
     */
    error InsufficientLiquidity(uint256 lotteryNumber, uint256 maxParticipants);

    error DrawAlreadyInProgress();

    ISynthetixCore public synthetix;
    IERC20 public linkToken;
    uint128 public marketId;

    uint256 public jackpot;
    uint256 public ticketCost;
    uint256 public feePercent;

    uint256 private currentDrawRound;
    bool private isDrawing;

    mapping(uint256 => mapping(uint256 => address[])) ticketBuckets;
    mapping(uint256 => uint256) requestIdToRound;

    constructor(
        ISynthetixCore _synthetix,
        address link,
        address vrf,
        uint256 _jackpot,
        uint256 _ticketCost,
        uint256 _feePercent
    ) VRFV2WrapperConsumerBase(link, vrf) {
        synthetix = _synthetix;
        linkToken = IERC20(link);
        jackpot = _jackpot;
        ticketCost = _ticketCost;
        feePercent = _feePercent;
    }

    function registerMarket() external {
        if (marketId == 0) {
            marketId = synthetix.registerMarket(address(this));
            emit LotteryRegistered(marketId);
        }
    }

    function buy(address beneficary, uint lotteryNumber) external {
        address[] storage bucketParticipants = ticketBuckets[currentDrawRound][
            lotteryNumber % _bucketCount()
        ];

        uint maxParticipants = getMaxBucketParticipants();

        if (bucketParticipants.length >= maxParticipants) {
            revert InsufficientLiquidity(lotteryNumber, maxParticipants);
        }

        IERC20(synthetix.getUsdToken()).transferFrom(
            msg.sender,
            address(this),
            ticketCost
        );
        bucketParticipants.push(beneficary);
    }

    function getMaxBucketParticipants() public view returns (uint256) {
        return synthetix.getWithdrawableMarketUsd(marketId) / jackpot;
    }

    function startDraw(uint256 maxLinkCost) external {
        if (isDrawing) {
            revert DrawAlreadyInProgress();
        }

        // because of the way chainlink's VRF contracts work, we must transfer link from the sender before continuing
        linkToken.transferFrom(msg.sender, address(this), maxLinkCost);

        // initialize the request for a random number, transfer LINK from the sender's account
        uint256 requestId = requestRandomness(
            500000, // max callback gas
            0, // min confirmations
            1 // number of random values
        );

        requestIdToRound[requestId] = currentDrawRound++;

        isDrawing = true;
    }

    function finishDraw(uint256 round, uint256 winningNumber) internal {
        address[] storage winners = ticketBuckets[round][
            winningNumber % _bucketCount()
        ];

        // if we dont have sufficient deposits, withdraw stablecoins from LPs
        IERC20 usdToken = IERC20(synthetix.getUsdToken());
        uint currentBalance = usdToken.balanceOf(address(this));
        if (currentBalance < jackpot * winners.length) {
            synthetix.withdrawMarketUsd(
                marketId,
                address(this),
                jackpot * winners.length - currentBalance
            );

            currentBalance = jackpot * winners.length;
        }

        // now send the deposits
        for (uint i = 0; i < winners.length; i++) {
            usdToken.transfer(winners[i], jackpot);
        }

        // update what our balance should be
        currentBalance -= jackpot * winners.length;

        // send anything remaining to the deposit
        if (currentBalance > 0) {
            synthetix.depositMarketUsd(marketId, address(this), currentBalance);
        }

        // allow for the next draw to start and unlock funds
        isDrawing = false;
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] memory randomWords
    ) internal virtual override {
        finishDraw(requestIdToRound[requestId], randomWords[0]);
    }

    function _bucketCount() internal view returns (uint256) {
        uint256 baseBuckets = jackpot / ticketCost;
        return baseBuckets + baseBuckets * feePercent;
    }

    function name(
        uint128 _marketId
    ) external view override returns (string memory n) {
        if (_marketId == marketId) {
            n = string(
                abi.encodePacked("Market ", bytes32(uint256(_marketId)))
            );
        }
    }

    function reportedDebt(uint128) external pure override returns (uint256) {
        return 0;
    }

    function minimumCredit(
        uint128 _marketId
    ) external view override returns (uint256 l) {
        if (_marketId == marketId) {
            // all collateral is locked during the draw
            if (isDrawing) {
                l = type(uint).max;
            }
        }
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
}
