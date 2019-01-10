pragma solidity ^0.5.0;

interface DutchX {
    // TODO

    function approvedTokens(address token)
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

contract DutchXPriceOracle {

    // TODO: Remove
    event LogNumber(string s, uint n);

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
        (num, den) = getPriceCustom(token, 0, true, 4.5 days, 9);
    }

    /// @param maximumTimePeriod maximum time period between clearing time of last auction and time
    function getPriceCustom(
        address token,
        uint time,
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


        address ethTokenMem = ethToken;
        uint auctionIndex;
        uint latestAuctionIndex = dutchX.getAuctionIndex(token, ethTokenMem);

        if (time == 0) {
            auctionIndex = latestAuctionIndex;
            time = now;
        } else {
            auctionIndex = computeAuctionIndex(token, 1, latestAuctionIndex - 1, time);
        }

        // Activity check
        if (dutchX.getClearingTime(token, ethToken, auctionIndex - numberOfAuctions - 1) < time - maximumTimePeriod) {
            return (0, 0);
        }

        (num, den) = getPricesAndMedian(token, numberOfAuctions, auctionIndex);
    }

    function getPricesAndMedian(
        address token,
        uint numberOfAuctions,
        uint auctionIndex
    )
        public
        view
        returns (uint, uint)
    {
        uint[] memory nums = new uint[](numberOfAuctions);
        uint[] memory dens = new uint[](numberOfAuctions);
        uint[] memory linkedListOfIndices = new uint[](numberOfAuctions);
        uint indexOfSmallest;

        for (uint i = 0; i < numberOfAuctions; i++) {
            // Loop begins by calling auction index lAI - 1 and ends by calling lAI - numberOfAcutions
            // That gives numberOfAuctions calls
            (uint num, uint den) = dutchX.getPriceInPastAuction(token, ethToken, auctionIndex - 1 - i);

            (nums[i], dens[i]) = (num, den);

            // We begin by comparing latest price to smallest price
            // Smallest price is given by prices[linkedListOfIndices.indexOfLargest]
            uint previousIndex;
            uint index = indexOfSmallest;

            for (uint j = 0; j < i; j++) {
                if (isSmaller(num, den, nums[index], dens[index])) {
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

        uint index = indexOfSmallest;

        for (uint i = 0; i < (numberOfAuctions - 1) / 2; i++) {
            index = linkedListOfIndices[index];
        }

        // We return floor-of-half value, because if we computed arithmetic average
        // between two middle values, the order of the numbers would increase
        return (nums[index], dens[index])
    }

    function computeAuctionIndex(address token, uint lowerBound, uint upperBound, uint time)
        public
        view
        returns (uint)
    {
        uint mid = (lowerBound + upperBound) / 2;
        uint clearingTime = dutchX.getClearingTime(token, ethToken, mid);

        if (time < clearingTime) {
            if (upperBound - lowerBound == 1) {
                return lowerBound;
            } else {
                return computeAuctionIndex(token, lowerBound, mid, time);
            }
        } else if (clearingTime == time) {
            return mid;
        } else {
            if (upperBound - lowerBound == 1) {
                return mid;
            } else {
                return computeAuctionIndex(token, mid, upperBound, time);
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