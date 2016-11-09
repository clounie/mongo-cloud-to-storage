describe("Mongo Deployment", function() {
  var MongoDeployment = require( '../lib/mongo-deployment' );
  var mongoConfig = require( '../config' ).mongoDeployments.test;
  var mongoDeployment;

  beforeAll(function() {
    mongoDeployment = new MongoDeployment();
    console.log( 'NOTE: in tests, MD = MongoDeployment instance' );
  });

  it( 'Should be type MongoDeployment', function () {
    expect( mongoDeployment.constructor ).toEqual( MongoDeployment );
  });

  describe( 'Config', function () {
    it('Config object used for tests should be valid', function() {
      expect( mongoConfig.username ).toBeString();
      expect( mongoConfig.apiKey ).toBeString();
      expect( mongoConfig.groupId ).toBeString();
      expect( mongoConfig.replicaSetName ).toBeString();
      expect( mongoConfig.providerInstances ).toBeNonEmptyArray();
      expect( mongoConfig.providerInstances ).toBeArrayOfStrings();
      expect( mongoConfig.clusterId ).toBeNull();
    });

    it( 'MD.config doesn\'t exist until MD.init() is called', function () {
      expect( mongoDeployment.config ).toBeUndefined();
    });

    it( 'MD.config should exist after init', function () {
      mongoDeployment.init( mongoConfig );
      expect( mongoDeployment.config ).toBeObject();
    });

    it('MD.config should be valid', function() {
      expect( mongoDeployment.config.username ).toBeString();
      expect( mongoDeployment.config.apiKey ).toBeString();
      expect( mongoDeployment.config.groupId ).toBeString();
      expect( mongoDeployment.config.replicaSetName ).toBeString();
      expect( mongoDeployment.config.providerInstances ).toBeNonEmptyArray();
      expect( mongoDeployment.config.providerInstances ).toBeArrayOfStrings();
      expect( mongoDeployment.config.clusterId ).toBeNull();
    });
  });
});