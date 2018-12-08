pragma solidity ^0.5.0;

contract DutchX {

}

contract DutchXPriceOracle {

    struct fraction {
        uint num;
        uint den;
    }

    modifier onlyWhitelisted(address token) {        
        // Require token to be whitelisted in DutchX
        require(isWhitelisted(token), "not whitelisted");
    }
    
    DutchX dutchX;
    address ethToken;
    
    constructor(DutchX _dutchX, address _ethToken)
        public
    {
        dutchX = _dutchX;
        ethToken = _ethToken;
    }

    function getPriceOfWhitelistedToken(address token)
        public
        view
        isWhitelisted(token);
        returns (uint num, uint den)
    {
        (num, den) = getPrice(token):
    }

    function getPrice(address token)
        public
        view
        returns (uint num, uint den)
    {
        (num, den) = getPriceFromLastNAuctions(token, 9);
    }

    function getPriceFromLastNAuctions(address token, uint numberOfAuctions)
        public
        view
        returns (uint num, uint den)
    {
        uint latestAuctionIndex = dutchX.getAuctionIndex(token, ethToken);

        fraction[] memory prices = new fraction[](numberOfAuctions);

        for (uint i = numberOfAuctions - 1; i >= 0; i--) {
            // Loop should begin by calling auction index lAI - numberOfAuctions
            // and end by calling lAI - 1
            // That gives numberOfAuctions calls
            (_num, _den) = getPriceInPastAuction(token, ethToken, latestAuctionIndex - 1 - i);

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