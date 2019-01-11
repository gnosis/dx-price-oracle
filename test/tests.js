const abi = require('ethereumjs-abi')

const { assertRejects } = require('./utils')

const { date112019, rand, generateDutchX, addToMock } = require('./constants')

const DutchXPriceOracle = artifacts.require('DutchXPriceOracle')
const DutchX = artifacts.require('DutchExchange')
const MockContract = artifacts.require('MockContract')

const approvedTokens = 'approvedTokens(address):(bool)'

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

	it('getPrice() correct', async () => {
		// 388800 = 4.5 days
		await testGetPriceCustom(0, true, 388800, 9, true)
		await testGetPriceCustom(0, true, 388800, 9, false)
	})

	it('getPriceCustom() correct', async () => {
		const latestAuctionIndex = (await dutchX.getAuctionIndex(tokenA, ethToken)).toNumber()
		const secondClearingTime = (await dutchX.getClearingTime(tokenA, ethToken, 2)).toNumber()
		const lastClearingTime = (await dutchX.getClearingTime(tokenA, ethToken, latestAuctionIndex - 1)).toNumber()

		let time, requireWhitelisted, whitelist, maximumTimePeriod
		for (let i = 0; i < 16; i++) {
			if (i % 2 <= 0) time = 0
			else time = rand(secondClearingTime, lastClearingTime)

			const auctionIndex = await computeAuctionIndex(time, latestAuctionIndex)
			const numberOfAuctions = rand(1, auctionIndex)

			if (i % 4 <= 1) requireWhitelisted = true
			else requireWhitelisted = false

			if (i % 8 <= 3) whitelist = true
			else whitelist = false

			if (i % 16 <= 7) {
				// Fails activity check

				// We need maximumTimePeriod < time - clearingTime of auction before
				// maximumTimePeriod = - 1

			} else {
				// Passes activity check


			}


			// await testGetPriceCustom(time, requireWhitelisted, whitelist)
		}
		// await testGetPriceCustom(0, true, 388800, 9, false)
		// await testGetPriceCustom(0, true, 388800, 9, true)
		// await testGetPriceCustom(0, false, 388800, 9, true)
		// await testGetPriceCustom(0, false, 388800, 9, false)
		// await testGetPriceCustom()
	})

	it('getPricesAndMedian() correct', async () => {
		const latestAuctionIndex = (await dutchX.getAuctionIndex(tokenA, ethToken)).toNumber()
		for (let i = 2; i < latestAuctionIndex + 1; i += 6) {
			const numberOfTimes = Math.ceil((latestAuctionIndex - i) / 10)
			for (let j = 0; j < numberOfTimes; j++) {
				const auctionIndex = rand(i, latestAuctionIndex)
				await testGetPricesAndMedian(i, auctionIndex)
			}
		}
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

		// should revert if time < clearingTime[0]
		assertRejects(priceOracle.computeAuctionIndex(tokenA, 1, 
			latestAuctionIndex - 1, date112019 - 20000))
		// should revert if clearingTime[0] < time < clearingTime[1]
		assertRejects(priceOracle.computeAuctionIndex(tokenA, 1, 
			latestAuctionIndex - 1, date112019 + 20000))

		// should revert if lowerBound is 0
		const clearingTime = (await dutchX.getClearingTime(tokenA, ethToken, 
			latestAuctionIndex / 2)).toNumber()
		assertRejects(priceOracle.computeAuctionIndex(tokenA, 0, 
			latestAuctionIndex - 1, clearingTime))

		// otherwise, should succeed
		for (let i = 1; i < latestAuctionIndex; i +=3) {			
			await testComputeAuctionIndex(i, latestAuctionIndex)
		}		
	})

	async function testGetPriceCustom(
		time, 
		requireWhitelisted, 
		maximumTimePeriod, 
		numberOfAuctions, 
		whitelist
	) {
		if (whitelist) {
			addToMock(mock, approvedTokens, [tokenA], [''])
		}

		if (requireWhitelisted && !whitelist) {
			const result = await priceOracle.getPriceCustom(tokenA, time, true, 
			maximumTimePeriod, numberOfAuctions)

			console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
			console.log('result',result)
			console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
			

			const num = result['0'].toNumber()
			assert.equal(num, 0, 'num not correct in getPriceCustom unwhitelisted')

			const den = result['1'].toNumber()
			assert.equal(den, 0, 'den not correct in getPriceCustom unwhitelisted')
		}
	}

	async function testGetPricesAndMedian(numberOfAuctions, auctionIndex) {
		
		const price = (await priceOracle.getPricesAndMedian(tokenA, numberOfAuctions, auctionIndex))
		const medianSol = price['0'].toNumber() / price['1'].toNumber()

		const pricesJS = []

		for (let i = 0; i < numberOfAuctions; i++) {
			const priceJS = await dutchX.getPriceInPastAuction(tokenA, ethToken, auctionIndex - 1 - i)
			pricesJS.push(priceJS['0'].toNumber() / priceJS['1'].toNumber())
		}

		pricesJS.sort((a, b) => a - b)

		const medianJS = pricesJS[Math.floor((pricesJS.length - 1) / 2)]

		assert.equal(medianSol, medianJS, 'getPricesAndMedian() not correct')
	}

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

		const clearingTime = (await dutchX.getClearingTime(tokenA, ethToken, 1)).toNumber()
		time = clearingTime + 30000 * (expectedAuctionIndex - 1)

		const auctionIndexSol = (await priceOracle.computeAuctionIndex(tokenA, 1, latestAuctionIndex - 1, time)).toNumber()

		const auctionIndexJS = await computeAuctionIndex(time, latestAuctionIndex)

		assert.equal(auctionIndexSol, auctionIndexJS, 'computeAuctionIndex not correct')
	}

	async function computeAuctionIndex(time, latestAuctionIndex) {
		// The following loop finds the auctionIndex by iterating one by one thru clearing prices
		larger = false
		let i = 1
		while (!larger) {
			if (i === latestAuctionIndex) {
				break
			}
			
			const clearingTime = await dutchX.getClearingTime(tokenA, ethToken, i)

			if (time < clearingTime) {
				larger = true
			} else {
				i++
			}
		}

		return i - 1
	}
})