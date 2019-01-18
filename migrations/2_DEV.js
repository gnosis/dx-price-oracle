const PriceOracle = artifacts.require('DutchXPriceOracle')
const Mock = artifacts.require('MockContract')

module.exports = async function (deployer, network, accounts) {
    if (network === 'development') {
        const mock = await deployer.deploy(Mock)
        await deployer.deploy(PriceOracle, mock.address, '0x0000000000000000000000000000000000000001')
    }
}