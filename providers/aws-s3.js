'use strict';

// npm modules
const _ = require( 'lodash' );
const debug = require( 'debug' )( 'provider:aws-s3' );
const request = require( 'request' );
const StreamingS3 = require( 'streaming-s3' );

module.exports = AwsS3Provider;

/**
 * Provides streaming uploads to AWS
 * @class
 */
function AwsS3Provider ( )
{
  return this;
}

/**
 * Initializes the config objects
 *
 * @param {Object} initConfig - Data from the main process about our AWS provider instance
 * @returns {AwsS3Provider} - This AwsS3Provider instance
 */
AwsS3Provider.prototype.init = function ( initConfig )
{
  this.config = initConfig;
  this.config.s3BucketName = this.config.s3BucketName.replace( 's3://', '' );
  return this; 
};

/**
 * Receives an uploadObj and uploads files to AWS S3 based on its values
 *
 * @param {string} downloadUrl - URL holding the Mongo Cloud backup file (tar.gz)
 * @param {string} destinationFile - Path in the S3 bucket where the backup file will be saved
 * @param {returnCallback} cb - The callback that handles the response
 * @returns {?function} - returnCallback if there's an error, otherwise doesn't return
 */
AwsS3Provider.prototype.upload = function ( downloadUrl, destinationFile, cb )
{
  debug( '    6. Uploading to provider bucket: s3://' + this.config.s3BucketName );

  if ( !_.isString( downloadUrl ) || !downloadUrl.length || downloadUrl.indexOf( 'http' ) !== 0 ) {
    return cb( 'Invalid downloadUrl' );
  }
  if ( !_.isString( destinationFile ) || !destinationFile.length ) {
    return cb( 'Invalid destinationFile' );
  }

  var uploadBucketConfig = {
    Bucket: this.config.s3BucketName,
    Key: destinationFile,
    ContentType: 'application/x-gzip',
    ACL: 'public-read'
  };
  var streamOpts = {
    concurrentParts: 10,
    waitTime: 10000,
    retries: 5,
    maxPartSize: 10*1024*1024 // Divide into 10 MiB pieces
  };

  var rStream = request.get( downloadUrl );
  var uploader = new StreamingS3( 
    rStream, 
    this.config.accessKeyId, 
    this.config.secretKey, 
    uploadBucketConfig, 
    streamOpts 
  );

  uploader.begin(); // important if callback not provided.
  debug( '      Upload has begun...' );

  uploader.on('data', function (bytesRead) {
    debug(bytesRead, ' bytes read.');
  });

  uploader.on('part', function (number) {
    debug('      Uploaded: Part ' + number );
  });

  // All parts uploaded, but upload not yet acknowledged.
  uploader.on('uploaded', function (stats) {
    debug( '      Uploaded to file: ', destinationFile );
    debug( '      Upload stats: ', JSON.stringify( stats ) );
    cb( null, stats );
  });

  // uploader.on('finished', function (resp, stats) {
  //   debug('Upload finished: ', resp);
  // });

  uploader.on('error', function (e) {
    debug('      Upload error: ', e);
    return cb( e );
  });
};

/**
 * Generic callback syntax
 * @callback requestCallback
 * @param {string} errorMessage
 * @param {Object} responseData
 */