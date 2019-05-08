
//
// args:
//   contractAddr: the address of the ERC contract from which we extract token holder addresses
//
// the address list is written to std output
//
const common = require('./common');
const ether = require('./ether');
const mtEther = require('./mtEther');
const Buffer = require('buffer/').Buffer;
const BN = require("bn.js");
const keccak = require('keccakjs');
const ETHERSCAN_APIKEY = "VRPDB8JW4CHSQV6A6AHBMGFWRA1E9PR6BC";
let transferEventTopic0 = '';
let onlyTurmsAMT = false;
let contractAddr = '';
let showHelp = false;

//
// entrypoint
//
process.argv.forEach(function (val, index, array) {
    if (index >= 2) {
	if (val == '--debug')
	    common.SHOW_DEBUG = true;
	else if (val == '--help')
	    showHelp = true;
	else if (val == '--only-turms')
	    onlyTurmsAMT = true;
	else if (!contractAddr)
	    contractAddr = val;
	else {
	    console.error('Unknown command line parameter: ' + val);
	    return;
	}
    }
    if (index >= array.length - 1)
	main();
});


function main() {
    if (!!showHelp) {
	console.error('usage: node makeAddrList [--only-turms] contractAddr');
	console.error('where:');
	console.error('  --only-turms - only include addresses that are registered with Turms AMT\n');
	console.error('  contractAddr - is the address of the ERC20 token for which you want to get');
	console.error('                 a list of all token holders.');
	console.error('this tool collects all transfer events from the specified contract.');
	console.error('fyi, according the ERC20 interface, the signature of the transfer event is:');
	console.error('  event Transfer(address indexed from, address indexed to, uint value);\n');
	console.error('for each from and to address the contract is queried to see if that address is');
	console.error('currently an owner. all owners are added to a list. the list is then sorted, and');
	console.error('duplicates are removed.');
	return;
    }
    makeAddrList(contractAddr, function() {
	process.exit();
    });
}


function makeAddrList(contractAddr, cb) {
    common.setupWeb3Node();
    mtEther.setNetwork('Mainnet');
    const keccak256 = new keccak(256);
    keccak256.update("Transfer(address,address,uint256)");
    transferEventTopic0 = '0x' + keccak256.digest('hex');
    //console.error('makeAddrList: transferEventTopic0 = ' + transferEventTopic0);
    getLogsNext(0, contractAddr, cb);
}



//
// recursive fcn to get logs for the passed contractAddr, starting a fromBlock.
//
function getLogsNext(fromBlock, contractAddr, cb) {
    const options = {
	fromBlock: fromBlock,
	toBlock: 'latest',
	address: contractAddr,
	topics: [ transferEventTopic0 ]
    };
    //console.log('getLogsNext: fromBlock = ' + fromBlock);
    ether.getLogs(options, function(err, eventResults) {
	if (!!err || !eventResults || eventResults.length == 0) {
	    if (!!err)
		console.error('makeAddrList: ether.getLogs err = ' + err);
	    //either an error, or maybe just no events
	    return;
	}
	parseLogResults(fromBlock, eventResults, 0, function(lastBlock) {
	    if (lastBlock != fromBlock)
		getLogsNext(lastBlock, contractAddr, cb);
	    else {
		//console.log('getLogsNext: fromBlock = ' + fromBlock + '; done');
		cb();
	    }
	});
    });
}


//
// cb(lastBlock)
// recursive fcn to parse passed idx of log event
// if addr is registered w/ turms (or if not necessary) then prints addr
//
function parseLogResults(fromBlock, eventResults, idx, cb) {
    //console.log('parseLogResults: fromBlock = ' + fromBlock + ', idx = ' + idx);
    if (idx >= eventResults.length) {
	cb(fromBlock);
    } else {
	const result = eventResults[idx];
	const blockNumber = parseInt(result.blockNumber);
	//first 2 chars are '0x'; we want rightmost 20 out of 32 bytes
	const fromAddr = '0x' + result.topics[1].substring(2 + 12*2);
	const toAddr = '0x' + result.topics[2].substring(2 + 12*2);
	//console.log(fromAddr);
	checkTurmsRegistration(toAddr, function(isTurms) {
	    if (isTurms)
		console.log(toAddr);
	    const lastBlock = (blockNumber > fromBlock) ? blockNumber : fromBlock;
	    parseLogResults(lastBlock, eventResults, idx + 1, cb);
	});
    }
}


// cb(isTurms)
// cb indicates true if turms registration is not required, or if addr is registered w/ turms
function checkTurmsRegistration(addr, cb) {
    if (!onlyTurmsAMT) {
	cb(true);
    } else {
	mtEther.accountQuery(addr, function(err, acctInfo) {
	    if (!!err) {
		console.log(err)
		process.exit();
	    }
	    cb(acctInfo.isValid);
	});
    }
}
