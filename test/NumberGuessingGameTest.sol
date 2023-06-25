// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "cannon-std/Cannon.sol";
import "../src/NumberGuessingGame.sol";

import "./fakes/AggregatorV3Mock.sol";

import "forge-std/console.sol";

contract NumberGuessingGameTest is Test {

    using Cannon for Vm;

    NumberGuessingGame market;
    ISynthetixCore synthetixCore;
    IERC20 usdToken;

    address vrf;

    IERC20 linkToken;

    address ownerAddress = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    function setUp() external {
        market = NumberGuessingGame(vm.getAddress("NumberGuessingGame"));
        synthetixCore = ISynthetixCore(vm.getAddress("synthetix.CoreProxy"));
        usdToken = IERC20(vm.getAddress("synthetix.USDProxy"));
        vrf = vm.getAddress("vrf.VRFWrapper");
        linkToken = IERC20(vm.getAddress("vrf.linkAggregator.linkToken.Token"));

        // delegate liquidity towards the market
        address myAddress = address(this);
        vm.startPrank(ownerAddress);

        // delegate collateral to the market instead of the sandbox market
        //MarketConfiguration.Data[] memory marketConfigs = new MarketConfiguration.Data[](1);
        //marketConfigs[0] = MarketConfiguration.Data(market.marketId(), 1e18, 1e18);
        //synthetixCore.setPoolConfiguration(1, marketConfigs);

        // transfer test tokens to the test contract rather than using prank all the time
        usdToken.transfer(myAddress, 100 * 1e18);
        linkToken.transfer(myAddress, linkToken.balanceOf(ownerAddress) / 2);

        vm.stopPrank();

        // approve usd token to the market so we can buy tickets
        usdToken.approve(address(market), type(uint256).max);
        
        // approve link token to the market so it can be taken for draw
        linkToken.approve(address(market), type(uint256).max);

        // for now, 
        // TODO: this shouldn't have to be a mock, just a problem with the underlying chainlink
        vm.mockCall(
            vrf,
            "",
            abi.encode(uint256(1e18))
        );
    }

    function testFailBuyTicketWithoutMoney() external {
        vm.prank(address(100000));
        market.buy(address(this), 42);
    }

    function testFailBuyMaxBucketParticipants() external {
        // buy tickets one past the limit. the last ticket buy should fail
        uint256 maxBucketParticipants = market.getMaxBucketParticipants();
        for (uint i = 0;i < maxBucketParticipants + 1;i++) {
            market.buy(address(this), 42);
        }
    }

    function testCanBuyTicket() external {
        market.buy(address(this), 42);
    }

    function testFailCannotDrawWhenPreviousDrawInProgress() external {
        market.startDraw(10 * 1e18);
        market.startDraw(10 * 1e18);
    }

    function testFailDrawTicketTooExpensive() external {
        market.startDraw(1e6);
    }

    function testStartDrawLocksCollateral() external {
        market.startDraw(10 * 1e18);
        assert(market.minimumCredit(market.marketId()) > 1000 * 1e18);
    }

    function testCanDrawTicketWithoutWinner() external {
        market.startDraw(10 * 1e18);

        uint256[] memory randomAnswer = new uint256[](1);
        randomAnswer[0] = 43;

        vm.prank(vrf);
        market.rawFulfillRandomWords(1, randomAnswer);

        // should be able to draw another after this
        market.startDraw(10 * 1e18);
    }

    function testCanDrawTicketWithWinner() external {
        address beneficiary = address(100);
        address loser = address(101);
        market.buy(beneficiary, 42);
        market.buy(beneficiary, 42);
        market.buy(loser, 43);

        market.startDraw(10 * 1e18);

        uint256[] memory randomAnswer = new uint256[](1);
        
        // fulfilling withn the previously guessed number "42" causes address(this) to win twice
        randomAnswer[0] = 42;

        vm.prank(vrf);
        market.rawFulfillRandomWords(1, randomAnswer);

        // should be able to draw another after this
        market.startDraw(10 * 1e18);
        
        // winner should have received tokens--2 prizes from earlier buy
        assertEq(usdToken.balanceOf(beneficiary), market.prize() * 2);

        // loser gets nothing
        assertEq(usdToken.balanceOf(loser), 0);

        // market should be left with nothing
        assertEq(usdToken.balanceOf(address(market)), 0);
    }
}
