# Blockchain Project 2

This is my implementation of the Project 2 for Blockchain.  It migrates to
async levelDB calls for storing and retrieving the blockchain.  This requires
some alterations to the flow of the program as these calls are best written
as async.

### Prerequisites

This simple blockchain depends on `level`, `crypto-js` and `debug`.

### Installation

```
npm install
```

## Testing

To test code:
1: Open a command prompt or shell terminal after install node.js.
2: Remove the chaindata folder, if present
3: Run `node simpleChain.js` (or `npm test` will do the same thing)

The test logic appears at the end of simpleChain.js so it will automatically
execute.  It follows the description from the project 2 readme.
