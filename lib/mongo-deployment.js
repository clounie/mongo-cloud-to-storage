'use strict';

// npm modules
const _ = require( 'lodash' );
const async = require( 'async' );
const debug = require( 'debug' )( 'lib:mongo-deployment' );
const request = require( 'request' );

// Non-module Identifiers
const BAD_REQUEST_STATUS_CODE_FLOOR = 300;

module.exports = MongoDeployment;

/**
 * Represents a Mongo Deployment on Mongo Cloud Manager
 * @class
 */
function MongoDeployment ( )
{
  return this;
}

/**
 * Initializes the config and requestOptionsTemplate objects
 *
 * @param {Object} initConfig - Data from the main process about our MongoDB deployment
 * @returns {MongoDeployment} - Returns this MongoDeployment instance
 */
MongoDeployment.prototype.init = function ( initConfig )
{
  this.config = initConfig;

  // Set here b/c we need config values; we set all at once for clarity
  this.requestOptionsTemplate = {
    uri: 'https://cloud.mongodb.com',
    auth: {
      user: this.config.username,
      pass: this.config.apiKey,
      sendImmediately: false // This must be false for request module to work with digest auth
    },
    headers: {
      'Content-Type': 'application/json'
    },
    json: true
  };
  return this;
};

/**
 * Get the group's cluster list
 * API Path: /api/public/v1.0/groups/<group_id>/clusters
 *
 * @param {requestCallback} cb - The callback that handles the response
 * @returns {?function} - returnCallback if there's an error, otherwise doesn't return 
 */
MongoDeployment.prototype.listClustersOfGroup = function ( cb )
{
  if ( !this.config.groupId ) {
    return cb( 'Invalid groupId: ' + this.config.groupId );
  }
  debug( '    1. List clusters. groupId = ' + this.config.groupId );

  const API_PATH = '/api/public/v1.0/groups/' + this.config.groupId + '/clusters';

  // Overwrite values in the default opts with ones specific to this method
  var opts = _.cloneDeep( this.requestOptionsTemplate );
  _.merge( opts, {
    method: 'GET',
    uri: opts.uri + API_PATH
  });

  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= BAD_REQUEST_STATUS_CODE_FLOOR ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    
    let results = _.get( body, 'results', [] );
    let clusterList = _.map( results, function ( cluster ) {
      return {
        clusterName:  cluster.clusterName,
        clusterId: cluster.id,
        replicaSetName: cluster.replicaSetName
      };
    });
    cb( null, clusterList );
  });
};


/**
 * Finds the cluster with the given replica set id
 *
 * @param {array}           clusters - The list of Mongo clusters which belong to this group
 * @param {requestCallback} cb - The callback that handles the response
 * @returns {?function} - returnCallback if there's an error, otherwise doesn't return 
 */
MongoDeployment.prototype.findClusterByReplicaSetName = function ( clusters, cb )
{
  if ( !_.get( clusters, 'length' ) ) {
    return cb( 'Cannot findClusterByReplicaSetName; clusters is invalid: ' + clusters );
  }
  debug( '    2. Get cluster by replicaSetId. clusters.length is ' + clusters.length );

  // Get cluster's snapshot list
  var clusterId = _.get( 
    _.find(
      clusters, 
      { replicaSetName: this.config.replicaSetName } 
    ), 
    'clusterId', 
    null 
  );

  if ( !clusterId ) {
    return cb( 'Cannot find cluster with name: ' + this.config.replicaSetName );
  }
  this.config.clusterId = clusterId;  
  cb( null );
};


/**
 * Get cluster's snapshot list
 * API Path: /api/public/v1.0/groups/<group_id>/clusters/<cluster_id>/snapshots
 *
 * @param {requestCallback} cb - The callback that handles the response
 */
MongoDeployment.prototype.listSnapshotsOfCluster = function ( cb )
{
  debug( '    3. List snapshots of cluster. clusterId = ' + this.config.clusterId );

  var clusterPath = '/api/public/v1.0/groups/' + 
                    this.config.groupId + 
                    '/clusters/' + 
                    this.config.clusterId + 
                    '/snapshots';
  var opts = _.cloneDeep( this.requestOptionsTemplate );
  _.merge( opts, {
    method: 'GET',
    uri: opts.uri + clusterPath
  });

  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= BAD_REQUEST_STATUS_CODE_FLOOR ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    let snapshotList = _.get( body, 'results', [] );
    cb( err, snapshotList );
  });
};


/**
 * Create a restore job; this generates an http link, which we will use to download the backup
 * API Path: /api/public/v1.0/groups/<group_id>/clusters/<cluster_id>/restoreJobs
 *
 * @param {Object[]}        snapshots - The list of available snapshots for this MongoDB deployment
 * @param {requestCallback} cb - The callback that handles the response
 * @returns {?function} - returnCallback if there's an error, otherwise doesn't return 
 */
MongoDeployment.prototype.createRestoreJobForLatestSnapshot = function ( snapshots, cb )
{
  var snapshotToDownload = this.pickObjWithHighestFieldValue( snapshots, 'created.date' );
  if ( !snapshotToDownload ) {
    return cb( 'No snapshots to download; snapshots = ', snapshots );
  }
  debug( '    4. Create restoreJob for latest snapshot' );

  const restoreJobPath = '/api/public/v1.0/groups/' + 
                       this.config.groupId + 
                       '/clusters/' + 
                       this.config.clusterId + 
                       '/restoreJobs';

  var opts = _.cloneDeep( this.requestOptionsTemplate );
  _.merge( opts, {
    method: 'POST',
    uri: opts.uri + restoreJobPath,
    body: { snapshotId: snapshotToDownload.id }
  });

  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= BAD_REQUEST_STATUS_CODE_FLOOR ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    return cb( err, body );
  }); 
};


/**
 * Pings Mongo Cloud's servers for the latest restore job until it is ready
 *
 * @param {string[]} restoreJobs - 
 * @param {requestCallback} cb - The callback that handles the response
 * @returns {?function} - returnCallback if there's an error, otherwise doesn't return  
 */
MongoDeployment.prototype.getDownloadInfoFromRestoreJobList = function ( restoreJobs, cb )
{
  const FIVE_MINUTES_IN_SECONDS = 5 * 60;
  var dlCheck;
  var numChecks = 0;  
  var restoreJobUrl = _.get( restoreJobs, 'links[0].href', null );
  var self = this;
  var doNotCall = false;
  if ( !restoreJobUrl ) {
    return cb( 'Invalid restoreJobUrl: ' + restoreJobUrl + ', cannot continue' );
  }
  var opts = _.cloneDeep( this.requestOptionsTemplate );
  _.merge( opts, {
    method: 'GET',
    uri: restoreJobUrl
  });

  debug( '    5. Poll Mongo Cloud API until requested job is ready... (times out after 5 minutes)' );
  dlCheck = setInterval( checkIfRestoreJobIsReady, 1000 );

  function checkIfRestoreJobIsReady ( )
  {
    debug( '     ..poll #' + numChecks );
    request( opts, function ( err, res, body ) {
      if ( err || res.statusCode >= BAD_REQUEST_STATUS_CODE_FLOOR ) {
        clearInterval( dlCheck );
        return cb( err || 'Bad statusCode: ' + res.statusCode );
      }      
      numChecks++;
      if ( body.results[0].statusName === 'FINISHED' ) 
      {
        if ( !doNotCall ) {
          doNotCall = true;
          debug( '     [Restore job became ready after ' + numChecks + ' second(s)]' );
          clearInterval( dlCheck );
          self.listRestoreJobs( self.getLatestRestoreJobFromList.bind( self, cb ) );
        }
      } 
      else if ( numChecks >= FIVE_MINUTES_IN_SECONDS ) {
        clearInterval( dlCheck );
        return cb( 'getDownloadInfoFromRestoreJob timed out after 5 minutes.' );
      }
    });
  }
};


/**
 * Gets a list of restoreJobs belonging to a specific snapshot
 * @param {requestCallback} cb - The callback that handles the response
 */
MongoDeployment.prototype.listRestoreJobs = function ( cb )
{
  const restoreJobPath = '/api/public/v1.0/groups/' + 
                       this.config.groupId + 
                       '/clusters/' + 
                       this.config.clusterId + 
                       '/restoreJobs';
  var opts = _.cloneDeep( this.requestOptionsTemplate );
  _.merge( opts, {
    method: 'GET',
    uri: opts.uri + restoreJobPath
  });

  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= BAD_REQUEST_STATUS_CODE_FLOOR ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    return cb( err, body );
  }); 
};


/**
 * Utility. Gets the last restoreJob created from a list of restoreJobs
 *
 * @param {requestCallback} cb - The callback that handles the response
 * @param {string}          err - Any error that might have occurred retrieving the list
 * @param {Object[]}        list - An array of restoreJobs belonging to a specific snapshot
 * @returns {?function} - returnCallback if there's an error, otherwise doesn't return
 */
MongoDeployment.prototype.getLatestRestoreJobFromList = function ( cb, err, list )
{
  if ( err || !_.get( list, 'results.length') ) {
    return cb( err || 'No restore jobs exist in list: ' + list );
  }

  var url = _.get( list, 'results[0].delivery.url', null );
  var timestamp = _.get( list, 'results[0].timestamp.date', null );
  var destinationFile = 'mongo-cloud-backup_' + this.config.replicaSetName + '_' + timestamp + '.tar.gz';
  cb( err, url, destinationFile );
};


/**
 * Utility. Picks an object out of the array based on its value at fieldPath
 *
 * @param {array}  arr       - The array we'll iterate
 * @param {string} fieldPath - The path of our field (lodash _.get() syntax allowed)
 * @returns {object} - The arr object with the single highest value of fieldPath
 *
 * @example
 * // returns { nested: field: 'value' }
 * pickObjWithHighestFieldValue( [ { nested: { field: 'value' } } ], 'nested.field' );
 */
MongoDeployment.prototype.pickObjWithHighestFieldValue = function ( arr, fieldPath )
{
  var currentLatest = '0';
  var latestIdx = -1;
  _.each( arr, function ( val, idx ) {
    var testVal = _.get( val, fieldPath, '0' );
    if ( testVal > currentLatest ) {
      currentLatest = testVal;
      latestIdx = idx;
    }
  });
  return _.get( arr, '[' + latestIdx + ']', null );
};

/**
 * Get the download url and upload url for this MongoDeployment's backup
 *
 * @param {requestCallback} cb - The callback that handles the response
 */
MongoDeployment.prototype.getDownloadAndUploadInfo = function ( cb )
{
  /**
   * List of tasks to waterfall, each passing its results to the next in line
   *
   * Each task gets passed all arguments from the previous task, except the error.
   * If a function passes an error, the rest are skipped and processFinalResult is called.
   */
  const tasks = [
    this.listClustersOfGroup.bind( this ),
    this.findClusterByReplicaSetName.bind( this ),
    this.listSnapshotsOfCluster.bind( this ),
    this.createRestoreJobForLatestSnapshot.bind( this ),
    this.getDownloadInfoFromRestoreJobList.bind( this )
  ];
  async.waterfall( tasks, cb );
};


/**
 * Generic callback syntax
 * @callback requestCallback
 * @param {string} errorMessage
 * @param {Object} responseData
 */