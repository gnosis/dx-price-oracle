pragma solidity ^0.5.0;

import "./DutchXPriceOracle.sol";
import "@gnosis.pm/dx-contracts/contracts/base/TokenWhitelist.sol";


/// @title A DutchXPriceOracle that uses it's own whitelisted tokens instead of the ones of the DutchX
/// @author Angel Rodriguez - angel@gnosis.pm
contract WhitelistPriceOracle is TokenWhitelist, DutchXPriceOracle {
    constructor(DutchX _dutchX, address _ethToken, address _auctioneer)
        DutchXPriceOracle(_dutchX, _ethToken)
        public
    {
        auctioneer = _auctioneer;
    }

    function isWhitelisted(address token) 
        public
        view
        returns (bool) 
    {
        return approvedTokens[token];
    }
}