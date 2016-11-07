# mongo-cloud-to-storage
Transfers files from Mongo Cloud Manager to cloud storage using streams

## Install
`npm install mongo-cloud-to-storage`

## Usage
First of all, replace the values in [examples/config.template.js|examples/config.template.js] with your own. Then, try one of the below options for running it:

1. Pass in your config object:  

    ```js
    var c2s = require( 'mongo-cloud-to-storage' );
    c2s( /** your config object */ );
    ```  
2. Pass in a filePath to a config object:  

    ```js
    var c2s = require( 'mongo-cloud-to-storage' );
    // This will be passed to require
    c2s( '../../some/file/path' );
    ```
3. Run via `npm start`:  

    ```sh
    npm install mongo-cloud-to-storage
    ##
    # Place config.js in the containing folder
    # File tree would look like:
    #   node_modules
    #      mongo-cloud-to-storage/
    #         config.js
    ##
    cd node_modules/mongo-cloud-to-storage
    npm start
    ```

## Package Info

### Currently supported storage providers:
 * AWS S3

**Requires Node.js** `>= v4.0.0`