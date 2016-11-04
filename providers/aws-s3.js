'use strict';

// npm modules
const _ = require( 'lodash' );
const request = require( 'request' );
const streamingS3 = require( 'streaming-s3' );

// Local modules
const config = require( '../config' );

module.exports.upload = upload;

function upload( url, timestamp )
{
  var uploadBucketConfig = {
    Bucket: config.aws.s3BucketName,
    Key: 'mongo-cloud-backup_' + timestamp + '.tar.gz', // Name of destination file
    ContentType: 'application/x-gzip'
  };
  var streamOpts = {
    concurrentParts: 10,
    waitTime: 10000,
    retries: 5,
    maxPartSize: 10*1024*1024, // Divide into 10 MiB pieces
  };

  var rStream = request.get( url );
  var uploader = new streamingS3( rStream, config.aws.accessKeyId, config.aws.secretKey, uploadBucketConfig, streamOpts );

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
}