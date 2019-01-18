const abi = require('ethereumjs-abi')
const { wait } = require('@digix/tempo')(web3)

// Make @digix/tempo work with web3 1.0.0
web3.providers.HttpProvider.prototype.sendAsync = web3.providers.HttpProvider.prototype.send

const { logger, waitUntil, getTime, rand, assertRejects } = require('./utils')
const { generateDutchX, addToMock } = require('./auctions')

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

		// Instantiate DutchXPriceOracle with mock as DutchX
		priceOracle = await DutchXPriceOracle.new(mock.address, ethToken)
		
		// Generate auctions, save to mock, and give it DutchX-abi
		const currentTime = await getTime()
		await generateDutchX(currentTime, mock, tokenA, ethToken)
		dutchX = await DutchX.at(mock.address)

		// Move ganache time to after last clearing time
		const auctionIndex = await getAuctionIndex()
		const clearingTime = await getClearingTime(auctionIndex - 1)
		await waitUntil(clearingTime + 100)
	})

	it('getPrice() correct', async () => {
		await addToMock(mock, approvedTokens, [tokenA], ['true'])
		let medianSol = await getPrice()
		logger('getPrice() success case medianSol',medianSol)

		const auctionIndex = await getAuctionIndex()
		logger('getPrice() success case auctionIndex', auctionIndex)

		const medianJS = await getPricesAndMedianJS(9, auctionIndex)
		logger('getPrice() success case medianJS', medianJS)

		assert.equal(medianSol, medianJS, 'getPrice() success case not correct')

		await addToMock(mock, approvedTokens, [tokenA], [''])
		medianSol = await getPrice()
		logger('getPrice() failure case medianSol', medianSol)

		assert.deepEqual(medianSol, [0, 0], 'getPrice() failure case not correct')
	})

	it('getPriceCustom() correct', async () => {
		const latestAuctionIndex = await getAuctionIndex()
		const secondClearingTime = await getClearingTime(2)
		const lastClearingTime = await getClearingTime(latestAuctionIndex - 1)

		let time, requireWhitelisted, whitelist, passesActivityCheck
		for (let i = 0; i < 16; i++) {
			if (i % 2 <= 0) time = 0
			else time = rand(secondClearingTime, lastClearingTime)

			if (i % 4 <= 1) requireWhitelisted = true
			else requireWhitelisted = false

			if (i % 8 <= 3) whitelist = true
			else whitelist = false

			if (i % 16 <= 7) passesActivityCheck = false
			else passesActivityCheck = true			

			await testGetPriceCustom(whitelist, time, requireWhitelisted,
				passesActivityCheck, latestAuctionIndex)
		}
	})

	it('getPricesAndMedian() correct', async () => {
		const latestAuctionIndex = await getAuctionIndex()

		// Test getPricesAndMedian a number of times
		// E.g. for latestAuctionIndex = 50, we'll have
		// 5 tests for numberOfAuctions = 2  with a random auctionIndex between 3 and 50
		// 5 tests for numberOfAuctions = 8  with a random auctionIndex between 9 and 50
		// 4 tests for numberOfAuctions = 14 with a random auctionIndex between 15 and 50 etc.
		for (let i = 2; i < latestAuctionIndex + 1; i += 6) {
			const numberOfTimes = Math.ceil((latestAuctionIndex - i) / 10)
			for (let j = 0; j < numberOfTimes; j++) {
				const auctionIndex = rand(i + 1, latestAuctionIndex)
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
		const latestAuctionIndex = await getAuctionIndex()

		const firstTime = await getClearingTime(0)

		// should revert if time < clearingTime[0]
		assertRejects(priceOracle.computeAuctionIndex(tokenA, 1, 
			latestAuctionIndex - 1, latestAuctionIndex - 1, firstTime - 20000))
		// should revert if clearingTime[0] < time < clearingTime[1]
		assertRejects(priceOracle.computeAuctionIndex(tokenA, 1, 
			latestAuctionIndex - 1, latestAuctionIndex - 1, firstTime + 20000))

		const secondTime = await getClearingTime(1)
		
		// otherwise, should succeed
			for (let i = 1; i < latestAuctionIndex; i += 20) {
			// i represents expected auction index
			time = secondTime + 30000 * (i - 1)
			await testComputeAuctionIndex(time, latestAuctionIndex)
		}

		// Test three more cases:
		// 1. When time = one of the clearing time
		const randomTime = await getClearingTime(rand(1,latestAuctionIndex - 1))
		await testComputeAuctionIndex(randomTime, latestAuctionIndex)

		// 2. When time > last clearing time
		const lastTime = await getClearingTime(latestAuctionIndex - 1)
		await testComputeAuctionIndex(lastTime + 1000, latestAuctionIndex)

		// 3. When time is between penultimate and last clearing time
		const penultimateTime = await getClearingTime(latestAuctionIndex - 2)
		await(testComputeAuctionIndex(rand(penultimateTime + 1, lastTime - 1), latestAuctionIndex))
	})

	async function testGetPriceCustom(
		whitelist,
		time, 
		requireWhitelisted, 
		passesActivityCheck,
		latestAuctionIndex
	) {

		logger('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
		logger('testGetPriceCustom() called with:')
		logger('\twhitelist: ',whitelist)
		logger('\ttime: ', time)
		logger('\trequireWhitelisted: ', requireWhitelisted)
		logger('\tpassesActivityCheck: ', passesActivityCheck)
		logger('\tlatestAuctionIndex: ', latestAuctionIndex)
		logger('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')

		if (whitelist) {
			await addToMock(mock, approvedTokens, [tokenA], ['true'])
		} else {
			await addToMock(mock, approvedTokens, [tokenA], [''])
		}

		let auctionIndex
		let currentTime

		if (time == 0) {
			auctionIndex = latestAuctionIndex
			currentTime = await getTime()
		} else {
			auctionIndex = await computeAuctionIndex(time, latestAuctionIndex) + 1
			currentTime = time
		}

		logger('\ttestGetPriceCustom auctionIndex', auctionIndex)
		logger('\ttestGetPriceCustom currentTime', currentTime)

		const numberOfAuctions = rand(1, auctionIndex - 1)
		const clearingTime = await getClearingTime(auctionIndex - numberOfAuctions - 1)
		
		if (!passesActivityCheck) {
			// Fails activity check
			// We need maximumTimePeriod < time - clearingTime of auction before
			// Actual time will be slightly larger than currentTime
			// (since it will be next block's time)
			const maximumTimePeriod = currentTime - clearingTime - 1
			const resultParsed = await getPriceCustom(time, false, maximumTimePeriod, numberOfAuctions)
			assert.deepEqual(resultParsed, [0, 0], 'getPriceCustom() activity check fail not correct')
			return
		}

		// Passes activity check
		const maximumTimePeriod = currentTime - clearingTime + 5

		if (requireWhitelisted && !whitelist) {
			// Failure case
			const resultParsed = await getPriceCustom(time, true, maximumTimePeriod, numberOfAuctions)
			assert.deepEqual(resultParsed, [0, 0], 'getPriceCustom() unwhitelisted not correct')
			return
		}

		const medianSol = await getPriceCustom(time, false, maximumTimePeriod, numberOfAuctions)
		const medianJS = await getPricesAndMedianJS(numberOfAuctions, auctionIndex)
		assert.equal(medianSol, medianJS, 'getPriceCustom() not correct')
	}

	async function testGetPricesAndMedian(numberOfAuctions, auctionIndex) {

		logger('testGetPricesAndMedian numberOfAuctions, auctionIndex', numberOfAuctions, auctionIndex)
		
		const tx = await priceOracle.getPricesAndMedian.sendTransaction(tokenA, numberOfAuctions, auctionIndex)
		logger('\ttx.receipt.gasUsed', tx.receipt.gasUsed)

		const price = await priceOracle.getPricesAndMedian(tokenA, numberOfAuctions, auctionIndex)

		const medianSol = price['0'].toNumber() / price['1'].toNumber()
		logger('\ttestGetPricesAndMedian medianSol', medianSol)

		const medianJS = await getPricesAndMedianJS(numberOfAuctions, auctionIndex)
		logger('\ttestGetPricesAndMedian medianJS', medianJS)

		assert.equal(medianSol, medianJS, 'getPricesAndMedian() not correct')
	}

	async function getPricesAndMedianJS(numberOfAuctions, auctionIndex) {
		const pricesJS = []

		for (let i = 0; i < numberOfAuctions; i++) {
			const priceJS = await dutchX.getPriceInPastAuction(tokenA, ethToken, auctionIndex - 1 - i)
			pricesJS.push(priceJS['0'].toNumber() / priceJS['1'].toNumber())
		}

		pricesJS.sort((a, b) => a - b)
		const returnValue = pricesJS[Math.floor((pricesJS.length - 1) / 2)]

		logger('getPricesAndMedianJS() returning', returnValue)
		return returnValue
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

	async function testComputeAuctionIndex(time, latestAuctionIndex) {

		logger('testComputeAuctionIndex() called with:')
		logger('\ttime', time)
		logger('\tlatestAuctionIndex: ', latestAuctionIndex)

		const auctionIndexSol = (await priceOracle.computeAuctionIndex(tokenA, 1, latestAuctionIndex - 1, latestAuctionIndex - 1, time)).toNumber()

		logger('\ttestComputeAuctionIndex() auctionIndexSol', auctionIndexSol)

		const auctionIndexJS = await computeAuctionIndex(time, latestAuctionIndex)

		logger('\ttestComputeAuctionIndex() auctionIndexJS', auctionIndexJS)

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
			
			const clearingTime = await getClearingTime(i)

			if (time < clearingTime) {
				larger = true
			} else {
				i++
			}
		}

		return i - 1
	}

	// Helper fns

	async function getAuctionIndex() {
		return (await dutchX.getAuctionIndex(tokenA, ethToken)).toNumber()
	}

	async function getClearingTime(auctionIndex) {
		return (await dutchX.getClearingTime(tokenA, ethToken, auctionIndex)).toNumber()
	}

	async function getPrice() {
		logger('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
		logger('getPrice() called')
		logger('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
		const tx = await priceOracle.getPrice.sendTransaction(tokenA)
		logger('\tgetPrice() gasUsed', tx.receipt.gasUsed)
		const result = await priceOracle.getPrice(tokenA)
		return parseResult(result)
	}

	async function getPriceCustom(time, requireWhitelisted, maximumTimePeriod, numberOfAuctions) {
		logger('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
		logger('getPriceCustom() called with:')
		logger('\ttime: ', time)
		logger('\tmaximumTimePeriod: ', maximumTimePeriod)
		logger('\tnumberOfAuctions: ', numberOfAuctions)
		logger('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
		const result = await priceOracle.getPriceCustom(tokenA, time, requireWhitelisted,
			maximumTimePeriod, numberOfAuctions)

		const returnValue = parseResult(result)

		logger('getPriceCustom() returning', returnValue)
		return returnValue
	}

	function parseResult(result) {
		const [num, den] = [result['0'].toNumber(), result['1'].toNumber()]

		if (num === 0 && den === 0) {
			return [num, den]
		} else {
			return num / den
		}
	}
})