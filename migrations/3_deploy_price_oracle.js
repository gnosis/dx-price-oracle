const DutchXPriceOracle = artifacts.require('DutchXPriceOracle')
const DutchExchange = artifacts.require('DutchExchange')
const MockContract = artifacts.require('MockContract')

const ETHER_TOKEN_MOCK_ADDRESS = '0x0000000000000000000000000000000000000001'

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    console.log('Deploy DutchXPriceOracle using the mock DutchX:')
    const mockContract = await MockContract.deployed()
    console.log('  - Mock DutchX address: ' + mockContract.address)
    console.log('  - Mock WETH address: ' + ETHER_TOKEN_MOCK_ADDRESS)
    deployer.deploy(DutchXPriceOracle, mockContract.address, ETHER_TOKEN_MOCK_ADDRESS)

  } else {
    // Get the addresses for DutchX and WETH
    const dutchXAddress = await _getDutchXAddressFromNpmPackage()
    const dutchX = await DutchExchange.at(dutchXAddress)
    const wethAddress = await dutchX.ethToken.call()

    console.log('Deploy DutchXPriceOracle using the DutchX:')
    console.log('  - DutchX address: ' + dutchXAddress)
    console.log('  - WETH address: ' + wethAddress)
    await deployer.deploy(DutchXPriceOracle, dutchXAddress, wethAddress)
  }
}

async function _getDutchXAddressFromNpmPackage() {
  const networksFile = require('@gnosis.pm/dx-contracts/networks.json')
  const ContractName = 'DutchExchangeProxy'

  const Contract = networksFile[ContractName]
  if (!Contract) {
    throw new Error(`No ${ContractName} in ${networksFile}`)
  }

  const networkId = await web3.eth.net.getId()

  const networkInfo = Contract[networkId]
  if (!networkInfo) {
    throw new Error(`No address for ${ContractName} on network ${networkId} in ${networksFile}`)
  }

  return networkInfo.address
}
