const abi = require('ethereumjs-abi')
const { wait } = require('@digix/tempo')(web3)

// Make @digix/tempo work with web3 1.0.0
web3.providers.HttpProvider.prototype.sendAsync = web3.providers.HttpProvider.prototype.send

const { timestamp, assertRejects } = require('./utils')

const { date112019, rand, generateDutchX, addToMock } = require('./auctions')

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
		console.log('0',)
		addToMock(mock, approvedTokens, [tokenA], ['true'])
		console.log('1',)
		const result = await priceOracle.getPriceCustom(tokenA, 0, true, 388800, 9)
		// const result = await priceOracle.getPrice(tokenA)
		const medianSol = result['0'].toNumber() / result['1'].toNumber()

		console.log('2 medianSol',medianSol)
		const auctionIndex = (await dutchX.getAuctionIndex(tokenA, ethToken)).toNumber()
		console.log('3 auctionIndex',auctionIndex)
		const medianJS = await getPricesAndMedian(9, auctionIndex)
		console.log('4',medianJS)

		assert.equal(medianSol, medianJS, 'getPrice() not correct')
	})

	it('getPriceCustom() correct', async () => {
		const latestAuctionIndex = (await dutchX.getAuctionIndex(tokenA, ethToken)).toNumber()
		const secondClearingTime = (await dutchX.getClearingTime(tokenA, ethToken, 2)).toNumber()
		const lastClearingTime = (await dutchX.getClearingTime(tokenA, ethToken, latestAuctionIndex - 1)).toNumber()

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

			console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
			console.log('4', i, whitelist, time, 
				requireWhitelisted, passesActivityCheck, latestAuctionIndex)
			console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
			

			await testGetPriceCustom(whitelist, time, requireWhitelisted,
				passesActivityCheck, latestAuctionIndex)
		}
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
			latestAuctionIndex - 1, latestAuctionIndex - 1, date112019 - 20000))
		// should revert if clearingTime[0] < time < clearingTime[1]
		assertRejects(priceOracle.computeAuctionIndex(tokenA, 1, 
			latestAuctionIndex - 1, latestAuctionIndex - 1, date112019 + 20000))

		// otherwise, should succeed
		for (let i = 1; i < latestAuctionIndex; i +=3) {
			// console.log('i, latestAuctionIndex',i,latestAuctionIndex)		
			await testComputeAuctionIndex(i, latestAuctionIndex)
		}		
	})

	async function testGetPriceCustom(
		whitelist,
		time, 
		requireWhitelisted, 
		passesActivityCheck,
		latestAuctionIndex
	) {
		if (whitelist) {
			console.log('5.1 whitelist',whitelist)
			addToMock(mock, approvedTokens, [tokenA], ['true'])
		} else {
			console.log('5.2 whitelist',whitelist)
			addToMock(mock, approvedTokens, [tokenA], [''])
		}

		let auctionIndex
		let currentTime

		if (time == 0) {
			auctionIndex = latestAuctionIndex
			console.log('7.1 auctionIndex',auctionIndex)
			const lastClearingTime = (await dutchX.getClearingTime(tokenA, ethToken, auctionIndex - 1)).toNumber()
			console.log('7.2 lastClearingTime',lastClearingTime)
			const ganacheTime = (await web3.eth.getBlock('latest')).timestamp
			console.log('7.3 ganacheTime',ganacheTime)
			currentTime = lastClearingTime > ganacheTime ? lastClearingTime : ganacheTime
			console.log('7.4 currentTime',currentTime)
			await wait(currentTime - ganacheTime)
		} else {
			auctionIndex = await computeAuctionIndex(time, latestAuctionIndex) + 1
			console.log('7.5 auctionIndex',auctionIndex)
			currentTime = time
			console.log('7.6 currentTime',currentTime)
		}

		const numberOfAuctions = rand(1, auctionIndex - 1)
		console.log('7.7 numberOfAuctions',numberOfAuctions)
		const clearingTime = (await dutchX.getClearingTime(tokenA, ethToken, auctionIndex - numberOfAuctions - 1)).toNumber()
		console.log('7.3 clearingTime',clearingTime)
		console.log('7.4 time',time)
		
		if (!passesActivityCheck) {
			// Fails activity check
			// We need maximumTimePeriod < time - clearingTime of auction before
			// Actual time will be slightly larger than currentTime
			// (since it will be next block's time)
			const maximumTimePeriod = currentTime - clearingTime - 120

			console.log('9 maximumTimePeriod',maximumTimePeriod)


			const result = await priceOracle.getPriceCustom(tokenA, time, false,
				maximumTimePeriod, numberOfAuctions)

			console.log('10 result',result)

			const resultParsed = [result['0'].toNumber(), result['1'].toNumber()]
			assert.deepEqual(resultParsed, [0, 0], 'getPriceCustom() activity check fail not correct')

			return
		}

		// Passes activity check
		const maximumTimePeriod = currentTime - clearingTime
		console.log('11 maximumTimePeriod',maximumTimePeriod)

		if (requireWhitelisted && !whitelist) {
			// Failure case

			console.log('6 requireWhitelisted',requireWhitelisted)

			const result = await priceOracle.getPriceCustom(tokenA, time, true,
				maximumTimePeriod, numberOfAuctions)

			console.log('7 result',result)

			const resultParsed = [result['0'].toNumber(), result['1'].toNumber()]
			assert.deepEqual(resultParsed, [0, 0], 'getPriceCustom() unwhitelisted not correct')

			return
		}

		const result = await priceOracle.getPriceCustom(tokenA, time, false,
				maximumTimePeriod, numberOfAuctions)

		console.log('12 result',result)

		const medianSol = result['0'].toNumber() / result['1'].toNumber()

		const medianJS = await getPricesAndMedian(numberOfAuctions, auctionIndex)

		console.log('13 medianJS',medianJS)

		assert.equal(medianSol, medianJS, 'getPriceCustom() not correct')
	}

	async function testGetPricesAndMedian(numberOfAuctions, auctionIndex) {
		
		const price = (await priceOracle.getPricesAndMedian(tokenA, numberOfAuctions, auctionIndex))
		const medianSol = price['0'].toNumber() / price['1'].toNumber()

		const medianJS = await getPricesAndMedian(numberOfAuctions, auctionIndex)

		assert.equal(medianSol, medianJS, 'getPricesAndMedian() not correct')
	}

	async function getPricesAndMedian(numberOfAuctions, auctionIndex) {
		const pricesJS = []

		for (let i = 0; i < numberOfAuctions; i++) {
			const priceJS = await dutchX.getPriceInPastAuction(tokenA, ethToken, auctionIndex - 1 - i)
			pricesJS.push(priceJS['0'].toNumber() / priceJS['1'].toNumber())
		}

		pricesJS.sort((a, b) => a - b)

		return pricesJS[Math.floor((pricesJS.length - 1) / 2)]
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

		// console.log('A expectedAuctionIndex, latestAuctionIndex',expectedAuctionIndex, latestAuctionIndex)

		const clearingTime = (await dutchX.getClearingTime(tokenA, ethToken, 1)).toNumber()
		time = clearingTime + 30000 * (expectedAuctionIndex - 1)

		// console.log('B clearingTime',clearingTime)

		const auctionIndexSol = (await priceOracle.computeAuctionIndex(tokenA, 1, latestAuctionIndex - 1, latestAuctionIndex - 1, time)).toNumber()

		// console.log('C auctionIndexSol',auctionIndexSol)

		const auctionIndexJS = await computeAuctionIndex(time, latestAuctionIndex)

		// console.log('D auctionIndexJS',auctionIndexJS)

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
			
			const clearingTime = (await dutchX.getClearingTime(tokenA, ethToken, i)).toNumber()

			if (time < clearingTime) {
				larger = true
			} else {
				i++
			}
		}

		return i - 1
	}
})