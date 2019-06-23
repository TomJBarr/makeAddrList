
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
	if (val == '--verbose')
	    common.SHOW_DEBUG = true;
	else if (val == '--help')
	    showHelp = true;
	else if (val == '--only-turms')
	    onlyTurmsAMT = true;
	else if (!val)
	    ; //empty is ok
	else if (val.startsWith('--') ||  !!contractAddr) {
	    console.error('Unknown command line parameter: ' + val);
	    return;
	} else
	    contractAddr = val;
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
    if (!!common.SHOW_DEBUG)
	console.error('getting logs from contract: ' + contractAddr + ' from block ' + fromBlock);
    ether.getLogs(options, function(err, eventResults) {
	if (!!err || !eventResults || eventResults.length == 0) {
	    if (!!err)
		console.error('makeAddrList: ether.getLogs err = ' + err);
	    //either an error, or maybe just no events
	    cb();
	    return;
	}
	if (!eventResults || !eventResults.length) {
	    if (!!common.SHOW_DEBUG)
		console.error('no additional events');
	    cb();
	    return;
	}
	parseLogResults(fromBlock, eventResults, function(lastBlock) {
	    if (lastBlock != fromBlock)
		getLogsNext(lastBlock, contractAddr, cb);
	    else {
		if (!!common.SHOW_DEBUG)
		    console.error('parsed to block ' + lastBlock);
		cb();
	    }
	});
    });
}


//
// cb(lastBlock)
// fcn to parse passed log events
// if addr is registered w/ turms (or if not necessary) then prints addr
//
async function parseLogResults(fromBlock, eventResults, cb) {
    //console.log('parseLogResults: fromBlock = ' + fromBlock + ', idx = ' + idx);
    let blockNumber = fromBlock;
    if (!!common.SHOW_DEBUG)
	console.error('from block ' + fromBlock + ' parsing ' + eventResults.length + ' results');
    for (idx = 0; idx < eventResults.length; ++idx) {
	const result = eventResults[idx];
	const thisBlock = parseInt(result.blockNumber);
	if (thisBlock > blockNumber)
	    blockNumber = thisBlock;
	//first 2 chars are '0x'; we want rightmost 20 out of 32 bytes
	const fromAddr = '0x' + result.topics[1].substring(2 + 12*2);
	const toAddr = '0x' + result.topics[2].substring(2 + 12*2);
	if (!!common.SHOW_DEBUG)
	    console.error(idx + ': ' + fromAddr);
	else
	    process.stderr.write('.');
	const isTurms = await checkTurmsRegistration(fromAddr);
	if (isTurms)
	    console.log(fromAddr);
    }
    console.error('');
    cb(blockNumber);
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
    if (!!common.SHOW_DEBUG)
	console.error('getting transactions to contract: ' + contractAddr + ' from block ' + fromBlock);
    common.fetch(url, null, function(str, err) {
	if (!!err) {
	    console.log('getAllTxsNext: error retreiving transactions: ' + err);
	    cb(err);
	    return;
	}
	const response = JSON.parse(str);
	const txResults = response.result;
	if (!txResults || !txResults.length) {
	    if (!!common.SHOW_DEBUG)
		console.error('no additional results');
	    cb();
	    return;
	}
	parseTxResults(fromBlock, txResults, function(lastBlock) {
	    if (lastBlock != fromBlock)
		getAllTxsNext(lastBlock, contractAddr, cb);
	    else {
		if (!!common.SHOW_DEBUG)
		    console.error('parsed to block ' + lastBlock);
		cb();
	    }
	});
    });
}


//
// cb(lastBlock)
// fcn to parse passed transactions list
// if addr is registered w/ turms (or if not necessary) then prints addr
//
async function parseTxResults(fromBlock, txResults, cb) {
    //console.log('parseTxResults: fromBlock = ' + fromBlock + ', idx = ' + idx);
    let blockNumber = fromBlock;
    if (!!common.SHOW_DEBUG)
	console.error('from block ' + fromBlock + ' parsing ' + txResults.length + ' results');
    for (idx = 0; idx < txResults.length; ++idx) {
	const result = txResults[idx];
	const thisBlock = parseInt(result.blockNumber);
	if (thisBlock > blockNumber)
	    blockNumber = thisBlock;
	const fromAddr = result.from;
	if (!!common.SHOW_DEBUG)
	    process.stderr.write(idx + ': ' + fromAddr);
	else
	    process.stderr.write('.');
	const isTurms = await checkTurmsRegistration(fromAddr);
	if (isTurms)
	    console.log(fromAddr);
	if (!!common.SHOW_DEBUG)
	    console.error('');
    }
    console.error('');
    cb(blockNumber);
}


var checkTurmsRegistration = function(addr) {
    return new Promise(function(resolve, reject) {
	if (!onlyTurmsAMT) {
	    resolve(true);
	} else {
	    if (!!common.SHOW_DEBUG)
		process.stderr.write(' query');
	    mtEther.accountQuery(addr, function(err, acctInfo) {
		if (!!common.SHOW_DEBUG)
		    process.stderr.write(' err = ' + err);
		if (!!err) {
		    console.log(err)
		    reject(err);
		    //process.exit();
		}
		if (!acctInfo)
		    console.error(addr + ': acctInfo = ' + acctInfo);
		resolve(!!acctInfo && acctInfo.isValid);
	    });
	}
    });
}
