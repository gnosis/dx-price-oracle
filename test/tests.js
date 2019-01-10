const abi = require('ethereumjs-abi')

const { generateDutchX, addToMock } = require('./constants')

const DutchXPriceOracle = artifacts.require('DutchXPriceOracle')
const DutchX = artifacts.require('DutchExchange')
const MockContract = artifacts.require('MockContract')

const addressBase = '0x000000000000000000000000000000000000000'

const address1 = addressBase + '1'
const address2 = addressBase + '2'
const address3 = addressBase + '3'
const address4 = addressBase + '4'
const address5 = addressBase + '5'

const ethToken = address1
const tokenA = address2

contract('DutchXPriceOracle', async (accounts) => {

	let mock
	let dutchX
	let priceOracle

	before(async () => {
		// Instantiate mock
		mock = await MockContract.new()
		await generateDutchX(mock, tokenA, ethToken)
		dutchX = await DutchX.at(mock.address)
		
		// Instantiate DutchXPriceOracle with mock as DutchX
		priceOracle = await DutchXPriceOracle.new(mock.address, ethToken)
	})

	it('getPricesAndMedian() correct', async () => {
		// await 
	})

	it('isWhitelisted() correct', async () => {
		await testIsWhitelisted(address3, false)
		await testIsWhitelisted(address4, true)
		await testIsWhitelisted(address5, true)
	})

	it('isSmaller() correct', async () => {
		const fractions = [[1, 5, 0, 5], [1, 5, 1, 5], [1, 5, 2, 5], [9, 5, 10, 5]]
		for (let i = 0; i < fractions.length; i++) {
			await testIsSmaller(fractions[i])
		}
	})
		
	it('computeAuctionIndex() correct', async () => {
		const latestAuctionIndex = (await dutchX.getAuctionIndex(tokenA, ethToken)).toNumber()

		for (let i = 0; i < 50; i += 3) {			
			await testComputeAuctionIndex(i, latestAuctionIndex)
		}		
	})

	async function testIsWhitelisted(address, shouldBeWhitelisted) {

		await addToMock(
			mock, 'approvedTokens(address):(bool)',
			[address],
			[shouldBeWhitelisted ? '1' : ''])

		const isWhitelisted = await priceOracle.isWhitelisted(address)		

		assert.equal(isWhitelisted, shouldBeWhitelisted, 'isWhitelisted() not correct')
	}

	async function testIsSmaller(twoFractions) {
		const isSmallerSol = (await priceOracle.isSmaller(...twoFractions))

		const isSmallerJS = twoFractions[0] / twoFractions [1] < twoFractions[2] / twoFractions[3]

		assert.equal(isSmallerSol, isSmallerJS, 'isSmaller() not correct')
	}

	async function testComputeAuctionIndex(expectedAuctionIndex, latestAuctionIndex) {

		time = 1546300800 + 30000 * expectedAuctionIndex

		const auctionIndex = (await priceOracle.computeAuctionIndex(tokenA, 0, latestAuctionIndex - 1, time)).toNumber()

		// The following loop finds the auctionIndex by iterating one by one thru clearing prices
		larger = false
		i = 0
		while (!larger) {
			if (i === latestAuctionIndex - 1) {
				break
			}
			
			const clearingTime = await dutchX.getClearingTime(tokenA, ethToken, i)

			if (time < clearingTime) {
				larger = true
			} else {
				i++
			}
		}

		assert.equal(auctionIndex, i - 1, 'computeAuctionIndex not correct')
	}
})