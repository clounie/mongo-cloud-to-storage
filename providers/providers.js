'use strict';
/**
 * Object containing the available cloud providers
 *
 * @property {function} s3 - AWS S3 object storage
 */
module.exports = {
  aws: require( './aws-s3' )
  // gcs: require( './google-gcs' ) // TODO
};