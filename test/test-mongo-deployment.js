'use strict';
describe("Mongo Deployment", function() {
  var _ = require( 'lodash' );

  var MongoDeployment = require( '../lib/mongo-deployment' );
  var mongoConfig = require( '../config' ).mongoDeployments.test;
  var mongoDeployment;

  var globalTestVars = {
    clusterList: undefined,
    clusterId: undefined,
    snapshots: undefined,
    restoreJobs: undefined
  };

  var before = beforeAll; // Run once, before any test runs. Terrible name.

  before(function() {
    mongoDeployment = new MongoDeployment();
  });

  describe( 'MongoDeployment', function () 
  {
    it( 'Should be type MongoDeployment', function () {
      expect( mongoDeployment.constructor ).toEqual( MongoDeployment );
    });
  });

  describe( 'init', function () 
  {
    it( 'Config object used for tests should be valid', function() {
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

    it( 'MD.config should be valid', function() {
      expect( mongoDeployment.config.username ).toBeString();
      expect( mongoDeployment.config.apiKey ).toBeString();
      expect( mongoDeployment.config.groupId ).toBeString();
      expect( mongoDeployment.config.replicaSetName ).toBeString();
      expect( mongoDeployment.config.providerInstances ).toBeNonEmptyArray();
      expect( mongoDeployment.config.providerInstances ).toBeArrayOfStrings();
      expect( mongoDeployment.config.clusterId ).toBeNull();
    });

    it( 'MD.requestOptionsTemplate should have auth/connection info', function () {
      expect( mongoDeployment.requestOptionsTemplate ).toBeObject();
      expect( mongoDeployment.requestOptionsTemplate.auth ).toBeObject();
      expect( mongoDeployment.requestOptionsTemplate.auth.user ).toBeNonEmptyString();
      expect( mongoDeployment.requestOptionsTemplate.auth.pass ).toBeNonEmptyString();
    });
  });

  describe( 'listClustersOfGroup', function () 
  {
    describe( 'Given: a valid groupId', function () {
      it( 'Fails on non-existent groupId', function ( done ) {
        let backupGroupId = mongoDeployment.config.groupId;
        mongoDeployment.config.groupId = null;
        mongoDeployment.listClustersOfGroup( function ( err, list ) {
          expect( err ).toBeNonEmptyString();
          expect( list ).toBeUndefined();
          mongoDeployment.config.groupId = backupGroupId;
          done();
        });
      });
    });

    describe( 'When: I ask for a group\'s clusters', function () {
      it( 'Pass back error if URL specifies invalid resource', function ( done ) {
        let backupGroupId = mongoDeployment.config.groupId;
        mongoDeployment.config.groupId = 'some-non-ObjectId-string-';
        mongoDeployment.listClustersOfGroup( function ( err, list ) {
          expect( err ).toBeNonEmptyString();
          expect( list ).toBeUndefined();
          mongoDeployment.config.groupId = backupGroupId;
          done();
        });        
      });
      it( 'Keep going if URL is valid', function ( done ) {
        mongoDeployment.listClustersOfGroup( function ( err, list ) {
          expect( err ).toBeNull();
          globalTestVars.clusterList = list;
          done();
        });
      });
    });
    describe( 'Then I should get a valid cluster list', function () {
      it( 'List should be an array of objects', function ( ) {
        expect( globalTestVars.clusterList ).toBeArrayOfObjects();
      });
      it( 'List objects should have the correct fields', function ( ) {
        let obj = globalTestVars.clusterList[0];
        expect( obj ).toBeObject();
        expect( obj ).toHaveNonEmptyString( 'clusterName' );
        expect( obj ).toHaveNonEmptyString( 'clusterId' );
        expect( obj ).toHaveNonEmptyString( 'replicaSetName' );
      });
    });
  });

  describe( 'findClusterByReplicaSetName', function () 
  {
    describe( 'Given: a valid list of clusters', function () {
      it( 'Should error if cluster is invalid', function () {
        mongoDeployment.findClusterByReplicaSetName( null, function ( err ) {
          expect( err ).toBeNonEmptyString();
        });
      });
    });
    describe( 'When: I ask for a cluster based on its replica set name', function () {
      it( 'Should error if replicaSetName is invalid', function ( done ) {
        let backupReplicaSetName = mongoDeployment.config.replicaSetName;
        mongoDeployment.config.replicaSetName = null;
        mongoDeployment.findClusterByReplicaSetName( globalTestVars.clusterList, function ( err ) {
          expect( err ).toBeNonEmptyString();
          mongoDeployment.config.replicaSetName = backupReplicaSetName;
          done();
        });
      });
    });
    describe( 'Then: Give me a clusterId', function () {
      it( 'Should callback with a (string) clusterId when it has valid params', function ( done ) {
        mongoDeployment.findClusterByReplicaSetName( globalTestVars.clusterList, function ( err ) {
          expect( err ).toBeNull();
          expect( mongoDeployment.config.clusterId ).toBeNonEmptyString();
          globalTestVars.clusterId = mongoDeployment.config.clusterId;
          done();
        });
      });
    });
  });

  describe( 'listSnapshotsOfCluster', function ()
  {
    describe( 'Given: a Mongo Cloud cluster with backup snapshots', function () {
      it( 'Pass back error if URL specifies invalid resource', function ( done ) {
        let backupClusterId = mongoDeployment.config.clusterId;
        mongoDeployment.config.clusterId = null;
        mongoDeployment.listSnapshotsOfCluster( function ( err ) {
          expect( err ).toBeNonEmptyString();
          mongoDeployment.config.clusterId = backupClusterId;
          done();
        });
      });
    });
    describe( 'When: passed a cluster id', function () {
      it( 'Should have valid clusterId', function () {
        expect( mongoDeployment.config.clusterId ).toEqual( globalTestVars.clusterId );
      });
    });
    describe( 'Then: output list of snapshots belonging to that cluster', function () {
      it( 'Should have valid list of snapshots', function ( done ) {
        mongoDeployment.listSnapshotsOfCluster( function ( err, list ) {
          expect( err ).toBeNull();
          expect( list ).toBeArrayOfObjects();
          globalTestVars.snapshots = list;
          done();
        });
      });
    });
  });
  describe( 'createRestoreJobForLatestSnapshot', function ()
  {
    describe( 'Given: a list of snapshots', function () {
      it( 'Error if snapshot list is invalid', function ( done ) {
        mongoDeployment.createRestoreJobForLatestSnapshot( [], function ( err ) {
          expect( err ).toBeNonEmptyString();
          done();
        });
      });
    });
    describe( 'When: asked for the latest snapshot', function () {
      it( 'Error if request path is invalid', function ( done ) {
        let backupClusterId = mongoDeployment.config.clusterId;
        mongoDeployment.config.clusterId = null;
        mongoDeployment.createRestoreJobForLatestSnapshot( globalTestVars.snapshots, function ( err ) {
          expect( err ).toBeNonEmptyString();
          mongoDeployment.config.clusterId = backupClusterId;
          done();
        });        
      });
    });
    describe( 'Then: create a restore job for the latest snapshot', function () {
      it( 'Should give a restoreJob for the latest snapshot', function ( done ) {
        mongoDeployment.createRestoreJobForLatestSnapshot( globalTestVars.snapshots, function ( err, restoreJobs ) {
          expect( err ).toBeNull();
          expect( restoreJobs ).toBeObject();
          expect( restoreJobs.links ).toBeArrayOfObjects();
          globalTestVars.restoreJobs = restoreJobs;
          done();
        });
      });
    });
  });
  describe( 'getDownloadInfoFromRestoreJobList', function ()
  {
    describe( 'Given: a list of restoreJobs', function () {
      it( 'Error if restoreJob list is invalid', function ( done ) {
        mongoDeployment.getDownloadInfoFromRestoreJobList( { links: [] }, function ( err ) {
          expect( err ).toBeNonEmptyString();
          done();
        });
      });      
    });
    describe( 'When: asked for the latest restoreJob', function () {      
      it( 'Error if request path is invalid', function ( done ) {
        let badList = _.cloneDeep( globalTestVars.restoreJobs );
        badList.links[0].href = 'terribly bad url';
        mongoDeployment.getDownloadInfoFromRestoreJobList( badList, function ( err ) {
          expect( _.isObject( err ) || _.isString( err ) ).toBeTrue();
          done();
        });        
      });
    });
    describe( 'Then: only output the restoreJob when it is ready', function () {
      it( 'Should give a restoreJob for the latest snapshot', function ( done ) {
        mongoDeployment.getDownloadInfoFromRestoreJobList( globalTestVars.restoreJobs, function ( err, url, destinationFile ) {
          expect( err ).toBeNull();
          expect( url ).toBeNonEmptyString();
          expect( destinationFile ).toBeNonEmptyString();
          done();
        });
      });
    });
  });
  describe( 'listRestoreJobs', function ()
  {
    describe( 'Given: Valid cluster info', function () {
      it( 'Pass back error if URL specifies invalid resource', function ( done ) {
        let backupClusterId = mongoDeployment.config.clusterId;
        mongoDeployment.config.clusterId = null;
        mongoDeployment.listRestoreJobs( function ( err ) {
          expect( err ).toBeNonEmptyString();
          mongoDeployment.config.clusterId = backupClusterId;
          done();
        });
      });
    });
    describe( 'When: we ask for a a list of restore jobs', function () {
      it( '', function () {} );
    });
    describe( 'Then: callback with the request object for that list', function () {
      it( 'Should be a valid results object', function ( done ) {
        mongoDeployment.listRestoreJobs( function ( err, restoreJobList ) {
          expect( err ).toBeNull();
          expect( restoreJobList ).toBeObject();
          expect( restoreJobList.results ).toBeArrayOfObjects();
          expect( restoreJobList.results[0].timestamp.date ).toBeNonEmptyString();
          done();
        });
      });
    });
  });
  describe( 'getLatestRestoreJobFromList', function ()
  {
    describe( 'Given: List of restore jobs', function () {
      it( 'Should error if error is passed', function ( done ) {
        mongoDeployment.getLatestRestoreJobFromList( function ( err ) {
          expect( err ).toBeNonEmptyString();
          done();
        }, 'Pass this error', [] );
      });     
    });
    describe( 'When: When a valid list', function () {
      it( 'Should error if list doens\'t exist', function ( done ) {
        let error = null;
        let list = { results: [] };
        mongoDeployment.getLatestRestoreJobFromList( function ( err ) {
          expect( err ).toBeNonEmptyString();
          done();
        }, error, list );
      }); 
    });
    describe( 'Then: Give us the download and upload URLs (passed to provider)', function () {
      it( 'Should callback with a download url and destinationUrl', function ( done ) {
        let error = null;
        let list = { results: [ { delivery: { url: 'someUrl' }, timestamp: { date: '2016-04-01' } } ] };
        mongoDeployment.getLatestRestoreJobFromList( function ( err, url, destinationFile ) {
          expect( err ).toBeNull();
          expect( url ).toBeNonEmptyString();
          expect( destinationFile ).toBeNonEmptyString();
          done();
        }, error, list );
      });
    });
  });
  describe( 'pickObjWithHighestFieldValue', function ()
  {
    describe( 'Given: An array of objects I want to introspect, and a field of those objects', function () {
      it( 'If array param is invalid, return null', function () {
        let arr = '';
        let fieldPath = 'some.field';          
        expect( 
          mongoDeployment.pickObjWithHighestFieldValue( arr, fieldPath )
          ).toBeNull();
      });
      it( 'If field param is invalid, return null', function () {
        let arr = [{ someKey: 'someValue' }];
        let fieldPath = null;
        expect( 
          mongoDeployment.pickObjWithHighestFieldValue( arr, fieldPath )
          ).toBeNull();
      });      
    });
    describe( 'When: I ask for the highest value of a particular field', function () {
      it( 'If objects in array don\'t have field, return null', function () {
        let obj = { key: 'val' };
        let fieldPath = 'badkey'; 
        expect(       
          mongoDeployment.pickObjWithHighestFieldValue( [obj], fieldPath )
          ).toBeNull();
      });   
    });
    describe( 'Then: Return the object in this array whose field has the highest value', function () {
      it( 'Given one item, return its field, return that item', function () {
        let obj = { key: 'val' };
        let fieldPath = 'key';
        expect(
          mongoDeployment.pickObjWithHighestFieldValue( [obj], fieldPath )
          ).toEqual( obj );
      });
      it( 'Given one item with a nested field, return that item', function () {
        let obj = { key: { key: 'val' } };
        let fieldPath = 'key.key';
        expect(
          mongoDeployment.pickObjWithHighestFieldValue( [obj], fieldPath )
          ).toEqual( obj );
      });
      it( 'Given multiple items with nested fields, return the highest', function () {
        let obj = { key: { key: '1' } };
        let obj2 = { key: { key: '3' } };
        let obj3 = { key: { key: '2' } };
        let fieldPath = 'key.key';
        expect(
          mongoDeployment.pickObjWithHighestFieldValue( [obj, obj2, obj3], fieldPath )
          ).toEqual( obj2 );
      });      
    });
  });
});