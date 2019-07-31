var express = require('express');
var router = express.Router();

var config = require("./../app/config.js");
var coreApi = require("./../app/api/coreApi.js");

router.get("/blocks/:blockHeight", function(req, res) {
	var blockHeight = parseInt(req.params.blockHeight);

	res.locals.blockHeight = blockHeight;
	res.locals.result = {};

	res.locals.paginationBaseUrl = `/blocks/${blockHeight}/transactions`;

	coreApi.getBlockByHeight(blockHeight).then(function(result) {
    res.locals.result = result
    res.locals.result.txCount = result.tx.length

    res.json(res.locals);
	});
});

router.get("/blocks/:blockHeight/transactions", function(req, res) {
	var blockHeight = parseInt(req.params.blockHeight);

	res.locals.blockHeight = blockHeight;
	res.locals.result = {};

	var limit = config.site.blockTxPageSize;
	var offset = 0;

	if (req.query.limit) {
		limit = parseInt(req.query.limit);
	}

	if (req.query.offset) {
		offset = parseInt(req.query.offset);
	}

	res.locals.limit = limit;
	res.locals.offset = offset;
	res.locals.paginationBaseUrl = `/blocks/${blockHeight}/transactions`;

	coreApi.getBlockByHeight(blockHeight).then(function(result) {
		coreApi.getBlockByHashWithTransactions(result.hash, limit, offset).then(function(result) {
			
			// res.locals.result.getblock = result.getblock
			// res.locals.result.getblock.txCount = result.getblock.tx.length
			res.locals.result.transactions = result.transactions;
			res.locals.result.txInputsByTransaction = result.txInputsByTransaction;

			res.json(res.locals);
		});
	});
});

router.get("/transactions/:transactionId", function(req, res) {
	var txid = req.params.transactionId;

	var output = -1;
	if (req.query.output) {
		output = parseInt(req.query.output);
	}

	res.locals.txid = txid;
	res.locals.output = output;

	res.locals.result = {};

	coreApi.getRawTransaction(txid).then(function(rawTxResult) {
		res.locals.result.getrawtransaction = rawTxResult;

		client.command('getblock', rawTxResult.blockhash, function(err3, result3, resHeaders3) {
			res.locals.result.getblock = result3;

			var txids = [];
			for (var i = 0; i < rawTxResult.vin.length; i++) {
				if (!rawTxResult.vin[i].coinbase) {
					txids.push(rawTxResult.vin[i].txid);
				}
			}

			coreApi.getRawTransactions(txids).then(function(txInputs) {
				res.locals.result.txInputs = txInputs;

				res.json(res.locals);
			});
		});
	}).catch(function(err) {
    res.locals.error = err;
		res.locals.userMessage = "Failed to load transaction with txid=" + txid + ": " + err;

		res.json(res.locals);
	});
});

module.exports = router;
