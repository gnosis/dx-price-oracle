const PriceOracle = artifacts.require('DutchXPriceOracle')
const DutchX = artifacts.require('DutchExchange')

module.exports = async function (deployer, network, accounts) {
    if (network !== 'development') {
        // Either get address from npm package or hardcore an address:
        // dutchXAddress = await _getDutchXAddressFromNpmPackage()
        dutchXAddress = '0x25b8c27508a59bf498646d8819dc349876789f83'
        const dutchX = await DutchX.at(dutchXAddress)
        const ethTokenAddress = await dutchX.ethToken.call()
        console.log('ethTokenAddress', ethTokenAddress)
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
