pragma solidity ^0.5.0;

interface DutchX {

    function approvedTokens(address)
        external
        view
        returns (bool);

    function getAuctionIndex(
        address token1,
        address token2
    )
        external
        view
        returns (uint auctionIndex);

    function getClearingTime(
        address token1,
        address token2,
        uint auctionIndex
    )
        external
        view
        returns (uint time);

    function getPriceInPastAuction(
        address token1,
        address token2,
        uint auctionIndex
    )
        external
        view
        // price < 10^31
        returns (uint num, uint den);
}