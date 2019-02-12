const DutchXPriceOracle = artifacts.require('DutchXPriceOracle')
const WhitelistPriceOracle = artifacts.require('WhitelistPriceOracle')
const DutchExchange = artifacts.require('DutchExchange')
const MockContract = artifacts.require('MockContract')

const ETHER_TOKEN_MOCK_ADDRESS = '0x0000000000000000000000000000000000000001'

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    const mockContract = await MockContract.deployed()

    console.log('Deploy DutchXPriceOracle using the mock DutchX:')
    console.log('  - Mock DutchX address: ' + mockContract.address)
    console.log('  - Mock WETH address: ' + ETHER_TOKEN_MOCK_ADDRESS)
    deployer.deploy(DutchXPriceOracle, mockContract.address, ETHER_TOKEN_MOCK_ADDRESS)

    console.log('\nDeploy WhitelistPriceOracle using the mock DutchX:')
    console.log('  - Mock DutchX address: ' + mockContract.address)
    console.log('  - Mock WETH address: ' + ETHER_TOKEN_MOCK_ADDRESS)
    deployer.deploy(WhitelistPriceOracle, mockContract.address, ETHER_TOKEN_MOCK_ADDRESS)

  } else {
    // Get the addresses for DutchX and WETH
    const dutchXAddress = await _getDutchXAddressFromNpmPackage()
    const dutchX = await DutchExchange.at(dutchXAddress)
    const wethAddress = await dutchX.ethToken.call()
    const [account] = accounts

    console.log('Deploy DutchXPriceOracle using the DutchX:')
    console.log('  - DutchX address: ' + dutchXAddress)
    console.log('  - WETH address: ' + wethAddress)
    await deployer.deploy(DutchXPriceOracle, dutchXAddress, wethAddress)

    console.log('\nDeploy WhitelistPriceOracle using the DutchX:')
    console.log('  - DutchX address: ' + dutchXAddress)
    console.log('  - WETH address: ' + wethAddress)
    console.log('  - Auctioneer: ' + account)
    await deployer.deploy(
      WhitelistPriceOracle,
      dutchXAddress,
      wethAddress,
      account
    )
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
