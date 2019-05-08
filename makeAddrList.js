
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
	console.error('                 if contractAddr is not specified, then get all Turms addresses.');
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
    if (!!contractAddr) {
	const keccak256 = new keccak(256);
	keccak256.update("Transfer(address,address,uint256)");
	transferEventTopic0 = '0x' + keccak256.digest('hex');
	//console.error('makeAddrList: transferEventTopic0 = ' + transferEventTopic0);
	const fromBlock = (!!onlyTurmsAMT) ? mtEther.firstBlock : 0;
	getAllTxsNext(fromBlock, mtEther.EMT_CONTRACT_ADDR, cb);
	getLogsNext(fromBlock, contractAddr, cb);
    } else {
	onlyTurmsAMT = true;
	//don't need contract creation tx
	const fromBlock = parseInt(mtEther.firstBlock) + 1;
	getAllTxsNext(fromBlock, mtEther.EMT_CONTRACT_ADDR, cb);
    }
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



//
// recursive fcn to get all tx's for the passed contractAddr, starting from fromBlock.
//
//
// curl "https://api.etherscan.io/api?module=account&action=txlist&\
//       address=0x6a973275f5bccfe0c7309c9934d7f945c3138dfd&\
//       startblock=7498311&endblock=99999999&page=1&offset=1&sort=asc"
//
// {"status":"1","message":"OK",
//  "result": [ { "blockNumber":"7499714",
//                "timeStamp":"1554353856",
//                "hash":"0x6f7a92a0229b439a49b84897f6ad8f34afb0f1d239287ac16dcb8fe8c0ba893c",
//                "nonce":"35",
//                "blockHash":"0x5715ad1856d6eef9ec1e0de86c6afad6f106ba0756d1997fde5ee4368f65f3bf",
//                "transactionIndex":"159",
//                "from":"0xf84e459c7e3bea1ec0814ce1a345cccb88ab56c2",
//                "to":"0x6a973275f5bccfe0c7309c9934d7f945c3138dfd",
//                "value":"0",
//                "gas":"754428",
//                "gasPrice":"4000000000",
//                "isError":"0",
//                "txreceipt_status":"1",
//                "input":"0x......",
//                "contractAddress":"",
//                "cumulativeGasUsed":"7629508",
//                "gasUsed":"502952",
//                "confirmations":"221934"
//              }
//           ]
// }
//
function getAllTxsNext(fromBlock, contractAddr, cb) {
    let url = 'https://api.etherscan.io/api?module=account&action=txlist&address=ADDRESS&startblock=STARTBLOCK&endblock=99999999&page=1&offset=1000&sort=asc';
    url = url.replace('ADDRESS', contractAddr).replace('STARTBLOCK', fromBlock.toString());
    common.fetch(url, null, function(str, err) {
	if (!!err) {
	    console.log('getAllTxsNext: error retreiving transactions: ' + err);
	    cb(err);
	    return;
	}
	const response = JSON.parse(str);
	const txResults = response.result;
	parseTxResults(fromBlock, txResults, 0, function(lastBlock) {
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
// recursive fcn to parse passed idx of ttransactions list
// if addr is registered w/ turms (or if not necessary) then prints addr
//
function parseTxResults(fromBlock, txResults, idx, cb) {
    //console.log('parseTxResults: fromBlock = ' + fromBlock + ', idx = ' + idx);
    if (idx >= txResults.length) {
	cb(fromBlock);
    } else {
	const result = txResults[idx];
	const blockNumber = parseInt(result.blockNumber);
	const fromAddr = result.from;
	checkTurmsRegistration(fromAddr, function(isTurms) {
	    if (isTurms)
		console.log(fromAddr);
	    const lastBlock = (blockNumber > fromBlock) ? blockNumber : fromBlock;
	    parseTxResults(lastBlock, txResults, idx + 1, cb);
	});
    }
}


// cb(isTurms)
// cb indicates true if turms registration is not required, or if addr is registered w/ turms
function checkTurmsRegistration(addr, cb) {
    //console.log('checkTurmsRegistration: addr = ' + addr);
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
