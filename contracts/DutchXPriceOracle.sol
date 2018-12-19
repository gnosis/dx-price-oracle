pragma solidity ^0.5.0;

contract DutchX {
    // TODO

    mapping (address => mapping (address => uint)) public auctionStarts;

    function getAuctionIndex(
        address token1,
        address token2
    )
        public
        view
        returns (uint auctionIndex);

    function getPriceInPastAuction(
        address token1,
        address token2,
        uint auctionIndex
    )
        public
        view
        // price < 10^31
        returns (uint num, uint den);
}

contract DutchXPriceOracle {

    struct fraction {
        uint num;
        uint den;
    }
    
    DutchX dutchX;
    address ethToken;
    
    constructor(DutchX _dutchX, address _ethToken)
        public
    {
        dutchX = _dutchX;
        ethToken = _ethToken;
    }

    function getPrice(address token)
        public
        view
        returns (uint num, uint den)
    {
        if (!isWhitelisted(token)) {
            return (0, 0);
        }

        uint auctionStart = dutchX.auctionStarts(token, ethToken);

        // naive inactivity logic
        // 86400 = 24 hours
        if (auctionStart < now - 86400 && auctionStart > 1) {
            return (0, 0);
        }

        (num, den) = getPriceFromLastNAuctions(token, 9);
    }
    
    function getPriceFromLastNAuctions(address token, uint numberOfAuctions)
        public
        view
        returns (uint num, uint den)
    {
        uint latestAuctionIndex = dutchX.getAuctionIndex(token, ethToken);

        // TODO: optional requires:
        require(numberOfAuctions >= 1, "cannot be 0");
        require(latestAuctionIndex >= numberOfAuctions + 1, "not enough auctions");

        fraction[] memory prices = new fraction[](numberOfAuctions);

        for (uint i = 0; i < numberOfAuctions; i--) {
            // Loop should begin by calling auction index lAI - 1
            // and end by calling lAI - numberOfAcutions
            // That gives numberOfAuctions calls
            (uint _num, uint _den) = dutchX.getPriceInPastAuction(token, ethToken, latestAuctionIndex - 1 - i);

            // Prices are now sorted in reverse chronological order
            prices[i] = fraction(_num, _den);
        }

        (num, den) = getMedian(prices);
    }

    function getMedian(fraction[] memory prices)
        public
        pure
        returns (uint num, uint den)
    {
        // TODO
        // Will use algorithm described in https://stackoverflow.com/a/28822243
    }

    function isSmallerFraction(uint num1, uint den1, uint num2, uint den2)
        public
        pure
        returns (bool)
    {
        // Possibly use floating point numbers?

        return (num1 * den2 < num2 * den1);
    }

    function isWhitelisted(address token) 
        public
        view
        returns (bool)
    {
        return dutchX.approvedTokens(token);
    }
}