pragma solidity ^0.5.0;

contract DutchX {

}

contract DutchXPriceOracle {
    DutchX dutchX;
    address ethToken;
    
    constructor(DutchX _dutchX, address _ethToken)
        public
    {
        dutchX = _DutchX;
        ethToken = _ethToken;
    }

    function getPrice(address token)
        public
        view
        returns (uint num, uint den)
    {
        (num, den) = getPriceFromLastNAuctions(token, 10);

    }

    function getPriceFromLastNAuctions(address token, uint numberOfAuctions) {
        
    }
        uint latestAuctionIndex = dutchX.getAuctionIndex(token, ethToken);
        (num, den) = getPriceInPastAuction(token, ethToken, latestAuctionIndex - 1);

    }

    function isGreaterFraction(uint num1, uint den1, uint num2, uint den2)
        public
        pure
        returns (bool)
    {
        // Possibly use floating point numbers?

        return (num1 * den2 > num2 * den1);
    }
}