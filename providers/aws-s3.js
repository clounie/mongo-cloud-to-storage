'use strict';

// npm modules
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
 * @param {Object} uploadObj - Configuration options for uploading a file to AWS S3
 */
AwsS3Provider.prototype.upload = function ( uploadObj )
{
  console.log( '    6. Uploading to provider bucket: s3://' + this.config.s3BucketName );  
  var uploadBucketConfig = {
    Bucket: this.config.s3BucketName,
    Key: 'mongo-cloud-backup_' + uploadObj.timestamp + '.tar.gz', // Name of destination file
    ContentType: 'application/x-gzip'
  };
  var streamOpts = {
    concurrentParts: 10,
    waitTime: 10000,
    retries: 5,
    maxPartSize: 10*1024*1024 // Divide into 10 MiB pieces
  };

  var rStream = request.get( uploadObj.downloadUrl );
  var uploader = new StreamingS3( rStream, this.config.accessKeyId, this.config.secretKey, uploadBucketConfig, streamOpts );

  uploader.begin(); // important if callback not provided.
  console.log( '      Upload has begun...' );

  // uploader.on('data', function (bytesRead) {
  //   console.log(bytesRead, ' bytes read.');
  // });

  uploader.on('part', function (number) {
    console.log('      Uploaded: Part ' + number );
  });

  // All parts uploaded, but upload not yet acknowledged.
  uploader.on('uploaded', function (stats) {
    console.log('      Upload stats: ', JSON.stringify( stats ) );
  });

  // uploader.on('finished', function (resp, stats) {
  //   console.log('Upload finished: ', resp);
  // });

  uploader.on('error', function (e) {
    console.log('      Upload error: ', e);
  });
};