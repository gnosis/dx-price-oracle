const PriceOracle = artifacts.require('DutchXPriceOracle')
const MockContract = artifacts.require('MockContract')

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    console.log('Deploying DutchX MockContract')
    await deployer.deploy(MockContract)
  } else {
    console.log('No need to deploy any testing contract in network: ' + network)
  }
}