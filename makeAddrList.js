
//
// args:
//   contractAddr: the address of the ERC contract from which we extract token holder addresses
//   addrListFile: the address list is written to this file
//
//
const common = require('./common');
const ether = require('./ether');
const Buffer = require('buffer/').Buffer;
const BN = require("bn.js");
const keccak = require('keccakjs');
const ETHERSCAN_APIKEY = "VRPDB8JW4CHSQV6A6AHBMGFWRA1E9PR6BC";
let transferEventTopic0 = '';

//
// entrypoint
//
process.argv.forEach(function (val, index, array) {
    let showHelp = false;
    let contractAddr = '';
    let addrListFile = '';
    if (index >= 2) {
	if (val == '--debug')
	    common.SHOW_DEBUG = true;
	else if (val == '--help')
	    showHelp = true;
	else if (!contractAddr)
	    contractAddr = val;
	else if (!addrListFile)
	    addrListFile = val;
	else {
	    console.error('Unknown command line parameter: ' + val);
	    return;
	}
    }
    if (!!showHelp) {
	console.error('usage: node makeAddrList contractAddr addrListFile');
	console.error('where:');
	console.error('  contractAddr - is the address of the ERC20 token for which you want to get');
	console.error('                 a list of all token holders.');
	console.error('  addrListFile - is the file that will get the list of token holder addresses\n');
	console.error('this tool collects all transfer events from the specified contract.');
	console.error('fyi, according the ERC20 interface, the signature of the transfer event is:');
	console.error('  event Transfer(address indexed from, address indexed to, uint value);\n');
	console.error('for each from and to address the contract is queried to see if that address is');
	console.error('currently an owner. all owners are added to a list. the list is then sorted, and');
	console.error('duplicates are removed.');
	return;
    }
    if (index >= array.length - 1)
	makeAddrList(contractAddr, addrListFile);
});


function makeAddrList(contractAddr, addrListFile) {
    const keccak256 = new keccak(256);
    keccak256.update("Transfer(address,address,uint256)");
    transferEventTopic0 = '0x' + keccak256.digest('hex');
    //console.error('makeAddrList: transferEventTopic0 = ' + transferEventTopic0);
    getLogsNext(0, contractAddr, function() {
    });
}



function getLogsNext(fromBlock, contractAddr, cb) {
    const options = {
	fromBlock: fromBlock,
	toBlock: 'latest',
	address: contractAddr,
	topics: [ transferEventTopic0 ]
    };
    ether.getLogs(options, function(err, eventResults) {
	if (!!err || !eventResults || eventResults.length == 0) {
	    if (!!err)
		console.error('makeAddrList: ether.getLogs err = ' + err);
	    //either an error, or maybe just no events
	    return;
	}
	let lastBlock = fromBlock;
	for (let logIdx = 0; logIdx < eventResults.length; ++logIdx) {
	    const result = eventResults[logIdx];
	    const blockNumber = parseInt(result.blockNumber);
	    //first 2 chars are '0x'; we want rightmost 20 out of 32 bytes
	    const fromAddr = '0x' + result.topics[1].substring(2 + 12*2);
	    const toAddr = '0x' + result.topics[2].substring(2 + 12*2);
	    //console.log(fromAddr);
	    console.log(toAddr);
	    if (blockNumber > lastBlock)
		lastBlock = blockNumber
	}
	console.error('getLogsNext: ' + eventResults.length + ' records from ' + fromBlock + ' to ' + lastBlock);
	if (lastBlock != fromBlock || eventResults.length >= 1000)
	    getLogsNext(lastBlock, contractAddr, cb);
	else
	    cb()
    });
}
