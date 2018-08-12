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
async function addLevelDBStringAsync(key,value){
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
 * Utility method to get string data from LevelDB by key.
 *
 * This method is async, so the caller should
 * access the return via the Promise.
 **************************************************/
async function getLevelDBStringAsync(key){
  return new Promise(function(resolve, reject) {
    db.get(key, function(err, result) {
      if (err == undefined) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

/*****************************************************************
 * Utility method to add JSON data to LevelDB with a given key.
 *
 * This method is async.  If you need to know the data was saved
 * prior to continuing execution, use the returned Promise to
 * manage that.
 *****************************************************************/
async function addLevelDBJSONAsync(key,value) {
  return addLevelDBStringAsync(key, JSON.stringify(value));
}

/**************************************************
 * Utility method to get JSON data from LevelDB by key.
 *
 * This method is async, so the caller should
 * access the return via the Promise.
 **************************************************/
async function getLevelDBJSONAsync(key){
  let svalue = await getLevelDBStringAsync(key);
  let value = JSON.parse(svalue);
  return value;
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
  /**************************
   * Constructor for Blockchain
   *
   * height and previousBlockHash are used to cache those aspects of the
   * blockchain state.  Notice that all member methods call a lazy initialization
   * method prior to their contents.  These values will be set by that lazy
   * initializer prior to being accessed by any real functionality.
   *************************************************************************/
  constructor() {
    this.height = -1;
    this.previousBlockHash = "";
  }

  /***************************************************************************
   * Perform the actual Database initialization.
   *
   * This call is used if we have to initialize the leveldb database.  We
   * write a height of 0 for the genesis block, then we create and add it
   * at the key of 0.  Then we write a version of "1.0".  Once the version
   * is in leveldb, future runs will consider the database valid and not
   * delete the old chain.
   **************************************************************************/
  async _initDatastore() {
    await addLevelDBStringAsync("height", "0");
    let block = new Block("First block in the chain - Genesis block");
    // using internal method so it doesn't call _initDatastore() again
    this._addBlock(block);
    // finally set the version, now that the DB state is clean
    await addLevelDBStringAsync("version", "1.0");
  }

  /**************************************************************************
   * This is a lazy initialization routine used by all member methods
   * of the Blockchain.
   *
   * Prior to executing the body of other methods, this is always called to
   * ensure we are initialized.  The initialization is kept ouf of the
   * constructor because it relies on async levelDB calls and we want a
   * clean and fast constructor.
   *
   * If the cached height of the block chain is no longer -1, we infer that
   * the chain has been loaded or initialized already and this becomes a
   * no-op.
   *
   * If there is no "version" value in levelDB, or if it is not set to "1.0",
   * you have an unrecognized chain and we replace it.  Similarly, if the
   * chain DB did not exist, we will get the NotFoundError on version and
   * initialize it too.
   *
   * Other error types are thrown up the call stack.
   **************************************************************************/
  async _checkInit() {
    // TODO investigate babel and annotations to use this, rather than directly
    debug('checking if we need to initialize');
    if (this.height < 0) {
      try {
        debug('requesting version from DB');
        let version = await getLevelDBStringAsync("version");
        debug('got version of ' + version);
        if (version !== "1.0") {
          debug("Unrecognized version in leveldb, initializing database fresh");
          await this._initDatastore();
        }
      } catch (err) {
        if (err.type === "NotFoundError") {
          debug("No version value found in leveldb, initializing database fresh");
          await this._initDatastore();
        } else {
          console.error("Error checking for version in levelDB");
          throw err;
        }
      }
      try {
        debug('reading height of chain from DB');
        let sheight = await getLevelDBStringAsync("height");
        let height = parseInt(sheight);
        debug('got height of ' + height);
        this.height = height;
        debug('getting block at ' + height + ' to read the final hash');
        let block = await this.getBlock(this.height);
        this.previousBlockHash = block.hash;
        debug('all done, saved final hash of ' + this.previousBlockHash);
      } catch (err) {
        console.error("Error reading height/block data to initialize");
        throw err;
      }
    }
  }

  /********************************************************************
   * Internal add block method.
   *
   * This adds blocks to the chain but it omits two steps handled by
   * the public addBlock() call, below.  It does not set the height of
   * the new block and it does not set the previous block hash on the
   * new block.  This allows us to use this during initialization when
   * we want to explicitly add the genesis block with a fixed height/
   * previous hash value.
   ********************************************************************/
  async _addBlock(newBlock){
    // UTC timestamp
    newBlock.time = new Date().getTime().toString().slice(0,-3);

    // Block hash with SHA256 using newBlock and converting to a string
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();


    debug("adding block %s", JSON.stringify(newBlock));
  	await addLevelDBJSONAsync(newBlock.height, newBlock);
    await addLevelDBStringAsync("height", newBlock.height);

    if (newBlock.height > this.height) {
      this.height = newBlock.height;
    }
    this.previousBlockHash = newBlock.hash;
  }

/********************************************************************
 * Add block to the chain.
 *
 * This is the publicly used call to add blocks to the chain.  In addition
 * to saving it into levelDB, it also:
 *   1. Sets the height to the existing chain height +1, this adds it to the end
 *   2. Sets the previous block hash to the cached hash of the last added block
 * During the call to _addBlock, these values will factor into the SHA256
 * calculation and on successfully adding to levelDB, the cached height
 * and previousBlockHash values for the chain will be updated.
 ********************************************************************/
  async addBlock(newBlock) {
    newBlock.height = this.height+1;
    newBlock.previousBlockHash = this.previousBlockHash;
    await this._checkInit();
    await this._addBlock(newBlock);
  }

    /*****************************************************************
     * Get the block height of the chain.
     *
     * The block height of the chain is cached.  After the init call
     * finishes, we should have a cached height to return.  The init
     * call is at the start of all the member methods since we cannot
     * reasonably add it to the constructor.
     *****************************************************************/
    async getBlockHeight() {
      debug('getting block height of chain');
      await this._checkInit();
      return this.height;
    }

    /**********************************************************************
     * Get a block.
     *
     * This gets a block out of leveldb by it's height.
     *********************************************************************/
    async getBlock(blockHeight) {
      await this._checkInit();
      return getLevelDBJSONAsync(blockHeight);
    }


    /*********************************************************************
     * Validate a block.
     *
     * This helper method lets us validate a block.  The call expects the
     * fully formed block as an argument.  It does not validate the chain
     * around the block (i.e. previousHash) - only the block itself.
     *********************************************************************/
    async validateBlock(block){
      debug("validating block %s", JSON.stringify(block));
      await this._checkInit();
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

    /*************************************************************
     * Validate the chain.
     *
     * This is the call we expect end-uesrs to use to validate
     * the entire chain.  It uses the earlier methods to validate
     * individual blocks and the chain of hash references.  It
     * returns the list of errors, if any, as a Promise.
     *************************************************************/
    async validateChain() {
        await this._checkInit();

        debug("validating the chain");

        let errorLog = [];

        for (let i=0; i<=this.height; i++) {
          let block = await this.getBlock(i);

          // validate block
          if (!(await this.validateBlock(block))) errorLog.push(i);
          // compare blocks hash link
          if (i<this.height) {
            let blockHash = block.hash;
	          let nextBlock = await this.getBlock(i+1);
	          let previousHash = nextBlock.previousBlockHash;
	          if (blockHash !== previousHash) {
	            console.log("block " + i + " hash: " + block.hash + " does not match next previous hash of " + nextBlock.previousBlockHash);
	            errorLog.push(i);
	          }
          }
	      }
        if (errorLog.length>0) {
  	      console.log('Block errors = ' + errorLog.length);
  	      console.log('Blocks: '+errorLog);
  	    } else {
  	      console.log('No errors detected');
  	    }
        return errorLog;
    }
}


// =============================================================================

/********************************************
 * Beginning of test code for simpleChain.js
 ********************************************/

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

  let height = await blockchain.getBlockHeight();
  if (height <= 1) {
     debug('looks like a fresh chain, adding 10 blocks');
     let thenables = [];
	   for (let i=0; i<=10; i++) {
	     await blockchain.addBlock(new Block("test data " + i));
	   }
  } else {
     console.error('Found existing blockchain in levelDB, using that.  Is this what you wanted?  (see test code in simpleChain.js)');
  }
}

/**************************************
 * Helper method to validate the chain
 **************************************/
async function testValidateChain() {
  debug('testing valid chain');
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
  debug('test logic inducing errors at blocks 2,4,7');
  let inducedErrorBlocks = [2,4,7];
  thenables = [];
  for (let i = 0; i < inducedErrorBlocks.length; i++) {
    blockchain.getBlock(inducedErrorBlocks[i]).then(function(block) {
      block.data = 'induced chain error';
      thenables.push(addLevelDBJSONAsync(block.height, block));
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

debug("Initializing from LevelDB");

testLoadBlockchain()
  .then(testValidateChain)
  .then(testInduceErrors)
  .then(testValidateChain);
