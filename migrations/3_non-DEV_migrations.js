const PriceOracle = artifacts.require('DutchXPriceOracle')
const DutchX = artifacts.require('DutchExchange')

module.exports = async function (deployer, network, accounts) {
    if (network !== 'development') {
        dutchXAddress = await _getDutchXAddressFromNpmPackage()
        const dutchX = await DutchX.at(dutchXAddress)
        const ethTokenAddress = await dutchX.ethToken.call()
        await deployer.deploy(PriceOracle, dutchXAddress, ethTokenAddress)
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
