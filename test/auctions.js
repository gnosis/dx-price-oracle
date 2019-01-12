const abi = require('ethereumjs-abi')

const { rand } = require('./utils')

// 21600 = 6 hours
const WAITING_PERIOD_NEW_TOKEN_PAIR = 21600
// 600 = 10 minutes
WAITING_PERIOD_NEW_AUCTION = 600

const getPriceInPastAuction = 'getPriceInPastAuction(address,address,uint256):(uint256,uint256)'
const getClearingTime = 'getClearingTime(address,address,uint256):(uint256)'
const getAuctionIndex = 'getAuctionIndex(address,address):(uint256)'

const numberOfAuctions = 50

async function generateDutchX(mock, tokenA, tokenB) {

    // last closed auction has index numberOfAuctions - 1
    // hence latestAuctionIndex will be numberOfAuctions
    await addToMock(mock, getAuctionIndex, [tokenA, tokenB], [numberOfAuctions])

    // 1/1/2019 in Unix time stamp
    const currentDate = Math.floor(new Date() / 1000)

    // Generate auctions and print
    const auctions = generateAuctions(
        numberOfAuctions, [], currentDate, 100, 200, 10, 20, 10000, 50000)
    
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    console.log(auctions)
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    
    // Add all auctions to mock
    await generateMock(auctions, 0, mock, tokenA, tokenB)
}

async function generateMock(auctions, auctionIndex, mock, tokenA, tokenB) {

    if (auctions.length === 0) {
        // Recursion base case  
        return
    }

    const auction = auctions[0]

    // Save weighted price to mock
    await addToMock(
        mock, getPriceInPastAuction,
        [tokenA, tokenB, auctionIndex],
        [auction.num, auction.den])

    // Auction is not first auction
    // Save clearingTime to mock
    await addToMock(
        mock, getClearingTime,
        [tokenA, tokenB, auctionIndex],
        [auction.clearingTime])

    await generateMock(auctions.slice(1), auctionIndex + 1, mock, tokenA, tokenB)
}

// Number - should be >= 1
// Auctions - should start with []
// addTime - when token pair was added to DutchX
// minNum, maxNum, minDen, maxDen - uint256
// Length should be around 6 hours to simulate real-world behavior
function generateAuctions(
    number, auctions, addTime,
    minNum, maxNum,
    minDen, maxDen,
    minLength, maxLength
) {
    const auctionIndex = auctions.length;

    if (number === 0) {
        // Recursion base case
        return auctions
    } else if (auctionIndex === 0) {
        // First auction doesn't have auction start nor clearing time
        // (First price is saved from addTokenPair)
        auctions.push({
            auctionIndex,
            num: rand(minNum, maxNum),
            den: rand(minDen, maxDen),
            clearingTime: addTime,
        })
    } else {
        // Generate one auction and call fn recursively

        let clearingTime = auctions[auctionIndex - 1].clearingTime + rand(minLength, maxLength)

        if (auctionIndex === 1) {
            // Second auction begins after 6 hours of adding token pair
            clearingTime += WAITING_PERIOD_NEW_TOKEN_PAIR
        } else {
            // Other auctions begins at least 10 minutes after adding token pair
            clearingTime += WAITING_PERIOD_NEW_AUCTION
        }

        auctions.push({ 
            auctionIndex,
            num: rand(minNum, maxNum),
            den: rand(minDen, maxDen),
            clearingTime,
        })
    }    

    return generateAuctions(number - 1, ...Array.prototype.slice.call(arguments, 1))
}

async function addToMock(mock, sig, inputs, outputs) {
    // Fancy javascript to get return types as array
    const outputArray = sig.split(':').splice(1)[0].slice(1, -1).split(',')
    
    const calldata = abi.simpleEncode(sig, ...inputs.map(i => i.toString()))
    const returndata = abi.rawEncode([...outputArray], [...outputs.map(o => o.toString())])

    await mock.givenCalldataReturn(calldata, returndata)
}

module.exports = {
    generateDutchX,
    addToMock,
}