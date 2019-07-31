const _ = require('lodash');
const BigNumber = require('bignumber.js');

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
    res.locals.result = JSON.parse(JSON.stringify(result))
    res.locals.result.txCount = result.tx.length
    delete res.locals.result.tx

    res.locals.result = {
      hash: result.hash,
      confirmations: result.confirmations,
      height: result.height,
      merkleroot: result.merkleroot,
      txCount: result.tx.length
    }

    res.json(res.locals.result);
	});
});

function getIsCoinbase(vin) {
  for(const input of vin) {
    if(input.coinbase) {
      return true
    }
  }

  return false;
}

function getIsNullData(vout) {
  for(const output of vout) {
    if(output.scriptPubKey.type === "nulldata") {
      return true
    }
  }

  return false;
}

function getInputs(tx_id, vin, parent_txs) {
  let res = []
  for(const input of vin) {
    if(input.coinbase) {
      continue;
    }

    let parent_tx = _.find(parent_txs[tx_id], function(element) {
      return element.txid == input.txid;
    });
    let parent_vout = parent_tx.vout[input.vout];
    res.push({
      address: parent_vout.scriptPubKey.addresses[0],
      value: BigNumber(parent_vout.value)
    })
  }

  return res;
}

function getTotalValue(ins) {
  return ins.reduce((res, cur) => res.plus(cur.value), BigNumber(0.0));
}

function getOutputs(outputs) {
  let res = []
  for(const output of outputs) {
    if(output.scriptPubKey.addresses) {
      res.push({
        address: output.scriptPubKey.addresses[0],
        value: BigNumber(output.value)
      })  
    }
  }
  return res;
}

function getTransaction(tx, blockHeight, parent_tx) {
  let res = {
    transaction: {
      asset: "BSV",
      confirmations: tx.confirmations,
      blockHeight: blockHeight,
      blockHash: tx.blockhash,
      hash: tx.txid,
      inputsCount: tx.vin.length
    }
  }
  res.is_coinbase = getIsCoinbase(tx.vin);
  res.is_null_data = getIsNullData(tx.vout);
  res.transaction.inputs = getInputs(tx.txid, tx.vin, parent_tx);
  res.transaction.inputsValue = getTotalValue(res.transaction.inputs);
  res.transaction.outputs = getOutputs(tx.vout);
  const transaction_outputs_value = getTotalValue(tx.vout);
  res.transaction.fee = (BigNumber(res.transaction.inputsValue) - BigNumber(transaction_outputs_value)).toFixed(8);

  return res;
}

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
			
			res.locals.result.transactions = result.transactions;
      res.locals.result.txInputsByTransaction = result.txInputsByTransaction;
      
      transactions = []
      for(const tx of result.transactions) {
        const res_trans = getTransaction(tx, blockHeight, result.txInputsByTransaction);


        if(!(res_trans.is_coinbase || res_trans.is_null_data))
          transactions.push(res_trans.transaction);
      }

      res.json(transactions);
      // res.json(res.locals.result);
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

        const res_trans = getTransaction(rawTxResult, result3.height, {[txid]: txInputs});

				res.json(res_trans.transaction);
			});
		});
	}).catch(function(err) {
    res.locals.error = err;
		res.locals.userMessage = "Failed to load transaction with txid=" + txid + ": " + err;

		res.json(res.locals);
	});
});

module.exports = router;
