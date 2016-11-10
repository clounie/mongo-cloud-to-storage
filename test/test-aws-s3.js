'use strict';
describe("Provider: AWS S3", function() {
  // Node.js API modules
  var crypto = require('crypto');

  // Third-party npm modules
  // var _ = require( 'lodash' );
  // var awscli = require( 'aws-cli' );
  var request = require( 'request' );

  // Local modules
  var AwsS3Provider = require( '../providers/aws-s3' );
  var awsConfig = require( '../config' ).providers.aws[process.env.TEST_AWS_USER];
  var awsS3Provider;

  var hash;
  var sourceFile = 'https://s3-us-west-1.amazonaws.com/nextworld-db-backups/DO_NOT_DELETE.txt';
  var destinationFile = 'DO_NOT_DELETE2.TXT';
  var invalidSourceFile = 'not-a-url';
  var invalidDestinationFile = null;

  var before = beforeAll; // Run once, before any test runs. Terrible name.

  before(function() {
    awsS3Provider = new AwsS3Provider();

    // Get hash of downloadFile
    var hashSHA512 = crypto.createHash( 'sha512', 'aws-test-key' );
    request( sourceFile, function ( err, res, body ) {
      hashSHA512.update( body );
      hash = hashSHA512.digest( 'hex' );
    });
  });

  var originalTimeout;

  beforeEach(function() {
      originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
  });

  afterEach(function() {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  describe( 'AwsS3Provider', function () 
  {
    it( 'Should be type AwsS3Provider', function () {
      expect( awsS3Provider.constructor ).toEqual( AwsS3Provider );
    });
  });

  describe( 'init', function () 
  {
    it( 'Config object used for tests should be valid', function() {
      expect( awsConfig.accessKeyId ).toBeString();
      expect( awsConfig.secretKey ).toBeString();
      expect( awsConfig.s3BucketName ).toBeString();
    });

    it( 'AWS.config doesn\'t exist until AWS.init() is called', function () {
      expect( awsS3Provider.config ).toBeUndefined();
    });

    it( 'AWS.config should exist after init', function () {
      awsS3Provider.init( awsConfig );
      expect( awsS3Provider.config ).toBeObject();
    });

    it( 'AWS.config should be valid', function() {
      expect( awsConfig.accessKeyId ).toBeString();
      expect( awsConfig.secretKey ).toBeString();
      expect( awsConfig.s3BucketName ).toBeString();
    });
  });

  describe( 'upload', function ()
  {

    it( 'Should error on invalid source file url', function ( done ) {
      awsS3Provider.upload( invalidSourceFile, destinationFile, function ( err ) {
        expect( err ).toBeNonEmptyString();
        done();
      });
    });
    it( 'Should error on invalid upload destination', function ( done ) {
      awsS3Provider.upload( sourceFile, invalidDestinationFile, function ( err ) {
        expect( err ).toBeNonEmptyString();
        done();
      });
    });
    it( 'Should upload the file without changes', function ( done ) {
      awsS3Provider.upload( sourceFile, destinationFile, function ( err ) {
        expect( err ).toBeNull();
        var url = 'https://s3-us-west-1.amazonaws.com/' + 
                  awsS3Provider.config.s3BucketName + 
                  '/' + 
                  destinationFile;
        setTimeout( function () {
          var req = request.get( url );
          var newHash = crypto.createHash( 'sha512', 'aws-test-key' );
          newHash.setEncoding('hex');

          req.on('end', function() {
            newHash.end();
            newHash = newHash.read();
            expect( newHash ).toEqual( hash );
            done();
          });
          req.pipe( newHash );
        }, 5000 );
      });
    });   
  });
});