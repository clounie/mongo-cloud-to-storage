'use strict';

// npm modules
const request = require( 'request' );
const streamingS3 = require( 'streaming-s3' );

// Local modules
let config = null;

module.exports = AwsS3Provider;

function AwsS3Provider ( initConfig )
{
  config = initConfig;
}

AwsS3Provider.prototype.upload = function ( uploadObj )
{
  var uploadBucketConfig = {
    Bucket: config.s3BucketName,
    Key: 'mongo-cloud-backup_' + uploadObj.timestamp + '.tar.gz', // Name of destination file
    ContentType: 'application/x-gzip'
  };
  var streamOpts = {
    concurrentParts: 10,
    waitTime: 10000,
    retries: 5,
    maxPartSize: 10*1024*1024, // Divide into 10 MiB pieces
  };

  var rStream = request.get( uploadObj.downloadUrl );
  var uploader = new streamingS3( rStream, config.accessKeyId, config.secretKey, uploadBucketConfig, streamOpts );

  uploader.begin(); // important if callback not provided.

  uploader.on('data', function (bytesRead) {
    console.log(bytesRead, ' bytes read.');
  });

  uploader.on('part', function (number) {
    console.log('Part ', number, ' uploaded.');
  });

  // All parts uploaded, but upload not yet acknowledged.
  uploader.on('uploaded', function (stats) {
    console.log('Upload stats: ', stats);
  });

  uploader.on('finished', function (resp, stats) {
    console.log('Upload finished: ', resp);
  });

  uploader.on('error', function (e) {
    console.log('Upload error: ', e);
  });
};