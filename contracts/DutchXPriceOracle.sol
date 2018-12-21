pragma solidity ^0.5.0;

contract DutchX {
    // TODO

    mapping (address => bool) public approvedTokens;

    function getAuctionIndex(
        address token1,
        address token2
    )
        public
        view
        returns (uint auctionIndex);

    function getAuctionStart(
        address token1,
        address token2,
        uint auctionIndex
    )
        public
        view
        returns (uint auctionStart);

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
        (num, den) = getPriceCustom(token, true, 4.5 days, 9);
    }
    
    function getPriceCustom(
        address token,
        bool requireWhitelisted,
        uint maximumTimePeriod,
        uint numberOfAuctions
    )
        public
        view
        returns (uint num, uint den)
    {
        // Whitelist check
        if (requireWhitelisted && !isWhitelisted(token)) {
            return (0, 0);
        }

        // Activity check
        uint latestAuctionIndex = dutchX.getAuctionIndex(token, ethToken);
        if (dutchX.getAuctionStart(token, ethToken, latestAuctionIndex - numberOfAuctions) < now - maximumTimePeriod) {
            return (0, 0);
        }

        (num, den) = getPricesAndMedian(token, numberOfAuctions, latestAuctionIndex);
    }

    function getPricesAndMedian(
        address token,
        uint numberOfAuctions,
        uint latestAuctionIndex
    )
        public
        view
        returns (uint num, uint den)
    {
        uint[] memory nums = new uint[](numberOfAuctions);
        uint[] memory dens = new uint[](numberOfAuctions);
        uint[] memory linkedListOfIndices = new uint[](numberOfAuctions);
        uint indexOfSmallest;

        for (uint i = 0; i < numberOfAuctions; i++) {
            // Loop begins by calling auction index lAI - 1 and ends by calling lAI - numberOfAcutions
            // That gives numberOfAuctions calls
            (uint _num, uint _den) = dutchX.getPriceInPastAuction(token, ethToken, latestAuctionIndex - 1 - i);

            (nums[i], dens[i]) = (_num, _den);

            // We begin by comparing latest price to smallest price
            // Smallest price is given by prices[linkedListOfIndices.indexOfLargest]
            uint previousIndex;
            uint index = indexOfSmallest;

            for (uint j = 0; j < i; j++) {
                if (isSmaller(_num, _den, nums[index], dens[index])) {
                    // Update current term to point to new term
                    // Current term is given by 
                    linkedListOfIndices[previousIndex] = i;

                    // Update new term to point to next term
                    linkedListOfIndices[i] = index;
                    
                    if (j == 0) {
                        indexOfSmallest = i;
                    }

                    break;
                }

                if (j == i - 1) {
                    // Loop is at last iteration
                    linkedListOfIndices[index] = i;
                    linkedListOfIndices[i] = indexOfSmallest;
                } else {
                    previousIndex = index;
                    index = linkedListOfIndices[index];
                }
            }
        }   
    }

    function isSmaller(uint num1, uint den1, uint num2, uint den2)
        public
        pure
        returns (bool)
    {
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