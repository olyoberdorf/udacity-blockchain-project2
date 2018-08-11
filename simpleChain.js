/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/

// Debug logging
const debug = require('debug')('simpleChain');

const SHA256 = require('crypto-js/sha256');
//const leveldb = require('./levelSandbox');

// import of levelSandbox not working
const level = require('level');
const chainDB = './chaindata';
const db = level(chainDB);

/*****************************************************************
 * Utility method to add string data to LevelDB with a given key.
 *
 * This method is async.  If you need to know the data was saved
 * prior to continuing execution, use the returned Promise to
 * manage that.
 *****************************************************************/
async function addLevelDBDataAsync(key,value){
  return new Promise(function(resolve, reject) {
      db.put(key, value, function(err) {
        if (err) {
          console.log('Block ' + key + ' submission failed', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
}

/**************************************************
 * Utility method to get data from LevelDB by key.
 *
 * This method is async, so the caller should
 * access the return via the Promise.
 **************************************************/
async function getLevelDBDataAsync(key){
  return new Promise(function(resolve, reject) {
    db.get(key, function(err, result) {
      if (err == undefined) {
        resolve(JSON.parse(result));
      } else {
        reject(err);
      }
    });
  });
}

// -----

/* ===== Block Class ==============================
|  Class with a constructor for block 			   |
|  ===============================================*/

class Block{
	constructor(data){
     this.hash = "",
     this.height = 0,
     this.body = data,
     this.time = 0,
     this.previousBlockHash = ""
    }
}

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

class Blockchain{
  constructor(){
    this.height = -1;
    this.previousBlockHash = "";
  }

  // Add new block
  async addBlock(newBlock){
    this.height = this.height+1;
    // Block height
    newBlock.height = this.height;
    // UTC timestamp
    newBlock.time = new Date().getTime().toString().slice(0,-3);
    // previous block hash
    newBlock.previousBlockHash = this.previousBlockHash;

    // Block hash with SHA256 using newBlock and converting to a string
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();


    this.previousBlockHash = newBlock.hash;

    debug("adding block %s", JSON.stringify(newBlock));
  	  return await addLevelDBDataAsync(newBlock.height, JSON.stringify(newBlock));
  }

    // Get block height
    getBlockHeight(){
      // we cache and maintain the height at all times, so this is easy
      return this.height;
    }

    // get block
    async getBlock(blockHeight) {
      return getLevelDBDataAsync(blockHeight);
    }

    /***********************************************************
     * Initialize the blockchain from levelDB.
     *
     * This method takes an argument, but it should be called
     * without one (default of 0).  The method is recursive
     * and after loading each block, it will increment the
     * block height and try to load the next one.  Eventually,
     * there will be no block (a "NotFoundError" in leveldb)
     * and we know we've reached the end of the chain.
     ************************************************************/
    async initFromLevelDB(blockHeight=0) {
      // note - recursive
      // TODO: tail recursion
      if (blockHeight == 0) {
        debug('initializing chain from leveldb');
      }
      try {
        let block = await this.getBlock(blockHeight);
        this.height = blockHeight;
        this.previousBlockHash = block.hash;
        return await this.initFromLevelDB(blockHeight+1);
      } catch(err) {
        if (err.type === "NotFoundError") {
	        // we read all blocks, if height is -1 there was no data, so add a genesis block
	        if (this.height == -1) {
	          // no data in levelDB, initialize genesis block
	          debug('no chain found in leveldb, initializing a new one with a genesis block');
	          return await this.addBlock(new Block("First block in the chain - Genesis block"));
	        } else {
	          debug('initialized from leveldb, height is %s', this.height);
	        }
        } else {
          console.error("Error during chain init from leveldb: " + err);
          throw err;
        }
      }
    }


    /*********************************************************************
     * Validate a block.
     *
     * This helper method lets us validate a block.  The call expects the
     * fully formed block as an argument.  It does not validate the chain
     * around the block (i.e. previousHash) - only the block itself.
     *********************************************************************/
    validateBlock(block){
      debug("validating block %s", JSON.stringify(block));
      // get block hash
      let blockHash = block.hash;
      let hashableBlock = Object.assign({}, block);
      hashableBlock.hash = "";
      // generate block hash
      let validBlockHash = SHA256(JSON.stringify(hashableBlock)).toString();
      // Compare
      if (block.hash===validBlockHash) {
          return true;
        } else {
          console.log('Block #'+block.height+' invalid hash:\n'+blockHash+'<>'+validBlockHash);
          return false;
        }
    }

    /***************************************************************************
     * Validate the chain.
     *
     * This call is also recursive.  It should be started by calling it without
     * arguments.  It will begin on the first block and recursively call
     * itself for the subsequent blocks until it hits the block height.
     *
     * Errors are added to a list and returned at the end of the recursion.
     ***************************************************************************/
    async validateChainAt(i=0, errorLog = []) {
        // note: recursive
        // TODO: use tail recursion
        if (i==0) {
          debug("validating the chain");
        }
        let block = await this.getBlock(i);

        // validate block
        if (!(this.validateBlock(block))) errorLog.push(i);
        // compare blocks hash link
        if (i<this.height) {
          let blockHash = block.hash;
	        let nextBlock = await this.getBlock(i+1);
	        let previousHash = nextBlock.previousBlockHash;
	        if (blockHash!==previousHash) {
	          console.log("block " + i + " hash: " + block.hash + " does not match next previous hash of " + nextBlock.previousBlockHash);
	          errorLog.push(i);
	        }
	        return await this.validateChainAt(i+1, errorLog);
	      } else {
	        console.log("detected end of chain at block #" + i);
	        return errorLog;
	      }
    }

    /*************************************************************
     * Validate the chain.
     *
     * This is the call we expect end-uesrs to use to validate
     * the entire chain.  It uses the earlier methods to validate
     * individual blocks and the chain of hash references.  It
     * returns the list of errors, if any, as a Promise.
     *************************************************************/
    async validateChain(){
      let previousHash = '';
      var i = 0;
      let errorLog = await this.validateChainAt();
      if (errorLog.length>0) {
	      console.log('Block errors = ' + errorLog.length);
	      console.log('Blocks: '+errorLog);
	    } else {
	      console.log('No errors detected');
	    }
	    return;
    }
}

// =============================================================================

/********************************************
 * Beginning of test code for simpleChain.js
 ********************************************/

// testing
debug('creating blockchain');
let blockchain = new Blockchain();

/***********************************************************
 * Helper method to load the chain.
 *
 * This will warn the user if an existing chain is found,
 * but it will use the existing chain.  To use a new chain,
 * remove the chaindata folder before running.
 ***********************************************************/
async function testLoadBlockchain() {
  debug('initializing from leveldb');
  return blockchain.initFromLevelDB().then(function() {
	  if (blockchain.height <= 1) {
	     let thenables = [];
		  for (var i=0; i<=10; i++) {
		    thenables.push(blockchain.addBlock(new Block("test data " + i)));
		  }
		  return Promise.all(thenables);
	  } else {
	    return console.error('Found existing blockchain in levelDB, using that.  Is this what you wanted?  (see test code in simpleChain.js)');
	  }});
}

/**************************************
 * Helper method to validate the chain
 **************************************/
async function testValidateChain() {
  return blockchain.validateChain();
}

/**********************************************
 * Helper method to induce errors in the chain.
 *
 * We want to pass validation on the initial
 * chain, but then we want to test the failure
 * catching.  This induces errors in Blocks
 * 2, 4, and 7 so the chain will fail to
 * validate.
 **********************************************/
async function testInduceErrors() {
      let inducedErrorBlocks = [2,4,7];
      thenables = [];
      for (var i = 0; i < inducedErrorBlocks.length; i++) {
        blockchain.getBlock(inducedErrorBlocks[i]).then(function(block) {
          block.data = 'induced chain error';
          thenables.push(addLevelDBDataAsync(block.height, JSON.stringify(block)));
        });
      }
      return Promise.all(thenables);
}

/*****************************************************************************
 * Run the full test.
 *
 * 1. Load the blockchain (warn if it exists, else create one)
 * 2. Validate the chain, it should pass
 * 3. Induce errors in blocks 2, 4, and 7
 * 4. Validate the chain, it should fail and complain about blocks 2, 4, and 7
 *****************************************************************************/
testLoadBlockchain(blockchain)
.then(testValidateChain)
.then(testInduceErrors)
.then(testValidateChain)
