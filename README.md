# Blockchain Project 2

This is my implementation of the Project 2 for Blockchain.  It migrates to
async `levelDB` calls for storing and retrieving the blockchain.  This requires
some alterations to the flow of the program as these calls are best written
as async.

### Prerequisites

This simple blockchain depends on `level`, `crypto-js` and `debug`.

### Installation

```
npm install
```

## Notes

I took the following liberties in designing my blockchain code.

 1. The block validation method operates on block data, rather than rereading
    it from `levelDB`.  You can see that the block was pulled from `levelDB`
    prior to calling this method.  I believe this satisfies the intent of the
    project.
 2. The `getBlockHeight` call returns the height of the chain, but it is using
    the cached value from the initial load (or computed from subsequent
    `addBlock` calls).  This is more efficient than reading data from `levelDB`
    every time.
 3. I included logic to load on subsequent runs.  This probably is not what is
    intended for the test, but seems like an obvious feature to include.  So,
    to test a fresh chain simply delete the `chaindata` folder prior to running.
    If you run without deleting the chain, it will use the chain as is.  Note
    that if the chain was generated via the test code as I have it, it will
    already have the induced errors (though it also induces them again).
 4. The optional chain load mentioned in (3) is handled via a lazy initialization
    routine.  This routine is at the start of every member call in the
    Blockchain class.  This was my solution to the earlier project feedback.
    The lazy initialization will also create the database f

## Resubmit

This is a resubmission of the project.  The reviewer objected to my use of a
separate initialization call after the constructor.  I am not sure exactly
what they are looking for.  It seems like there are only a few options:

 1. Provide a simple constructor and an async init method as I had, and use it.
 2. Provide a reentrant lazy init method as a member of the class and call it at
    the start of all other methods.
 3. Provide a factory async method that does the load/create of leveldb, then
    passes the necessary state variables into the Blockchain constructor.  It
    could then resolve to the constructed Blockchain.

I am resubmitting with approach 2.  If I misunderstood the reason for my
rejection, I'd appreciate guidelines accepting/rejecting these three proposals
so I know what the reviewers consider a valid architecture.

## Testing

To test code:
 1. Open a command prompt or shell terminal
 2. Remove the `chaindata` folder, if present
 3. Run `node simpleChain.js` (or `npm test` will do the same thing)

The test logic appears at the end of `simpleChain.js` so it will automatically
execute.  It follows the description from the project 2 readme, with the
caveats listed in *Notes* and *Resubmit* above.
