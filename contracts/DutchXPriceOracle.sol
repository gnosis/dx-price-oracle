pragma solidity ^0.5.0;

contract DutchX {
    // TODO
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

        for (uint i = numberOfAuctions - 1; i >= 0; i--) {
            // Loop should begin by calling auction index lAI - numberOfAuctions
            // and end by calling lAI - 1
            // That gives numberOfAuctions calls
            (uint _num, uint _den) = dutchX.getPriceInPastAuction(token, ethToken, latestAuctionIndex - 1 - i);

            // Prices are now sorted in chronological order
            prices.push(fraction(_num, _den));
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