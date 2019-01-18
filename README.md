[![Build Status](https://travis-ci.org/gnosis/dx-prce-oracle.svg?branch=master)](https://travis-ci.org/gnosis/dx-prce-oracle)

# DutchX Price Oracle

Contract to get reliable price oracle from DutchX protocol.

Currently, uses a mock-interface (in `./contracts/IDutchX.sol`) of the DutchX in order for Solidity to be happy.

But it uses the actual abi for the tests. This is imported in `./contracts/Imports.sol`.

## Tests

Tests use a [mock contract](https://github.com/gnosis/mock-contract) to imitate the behavior of the DutchX. We generate 50 auctions with random prices and clearing times, and then test each contract fn on that model.

The recommended ways to run the tests is:

`npx truffle test`

or 

`npx truffle test --log` (to get console logs)

Have fun!
