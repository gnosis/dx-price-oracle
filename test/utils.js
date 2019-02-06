const { wait } = require('@digix/tempo')(web3)
const {
  log
} = require('minimist')(process.argv.slice(2), { alias: { log: 'l' } })

const logger = log ? console.log.bind(console) : () => { }

async function waitUntil(minimum) {
    const ganacheTime = await getTime()
    const larger = minimum > ganacheTime ? minimum : ganacheTime
    await wait(larger - ganacheTime)
}

async function getTime() {
    return (await web3.eth.getBlock('latest')).timestamp
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

const assertRejects = async (q, msg) => {
    let res, catchFlag = false
    try {
        res = await q
        // checks if there was a Log event and its argument l contains string "R<number>"
        catchFlag = res.logs && !!res.logs.find(log => log.event === 'Log' && /\bR(\d+\.?)+/.test(log.args.l))
    } catch (e) {
        catchFlag = true
    } finally {
        if (!catchFlag) {
            assert.fail(res, null, msg)
        }
    }
}

module.exports = {
    logger,
    waitUntil,
    getTime,
    rand,
    assertRejects,
}
