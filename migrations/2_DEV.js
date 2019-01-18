const PriceOracle = artifacts.require('DutchXPriceOracle')
const Mock = artifacts.require('MockContract')

module.exports = async function (deployer, network, accounts) {
    if (network === 'development') {
        await deployer
            .then(() => deployer.deploy(Mock))
            .then(() => deployer.deploy(PriceOracle, Mock.address, '0x0000000000000000000000000000000000000001'))
    }
}