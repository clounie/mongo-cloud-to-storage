/**
 * Object containing the available cloud providers
 *
 * @property {function} s3 - AWS S3 object storage
 */
module.exports = {
	s3: require( './aws-s3' )
};