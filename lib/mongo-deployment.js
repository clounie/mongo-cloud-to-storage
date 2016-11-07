'use strict';

// npm modules
const _ = require( 'lodash' );
const request = require( 'request' );

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
 */
MongoDeployment.prototype.init = function ( initConfig )
{
  console.log( 'initConfig = ', initConfig );
  this.config = initConfig;
  console.log( 'this.config = ', this.config );

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
 */
MongoDeployment.prototype.listClustersOfGroup = function ( cb )
{
  if ( !this.config.groupId ) {
    return cb( 'Invalid groupId: ' + this.config.groupId );
  }
  console.log( '1. List clusters. groupId = ' + this.config.groupId );

  const API_PATH = '/api/public/v1.0/groups/' + this.config.groupId + '/clusters';

  // Overwrite values in the default opts with ones specific to this method
  var opts = _.cloneDeep( this.requestOptionsTemplate );
  _.merge( opts, {
    method: 'GET',
    uri: opts.uri + API_PATH
  });

  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= 300 ) {
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
 * @param {array} clusters - The list of Mongo clusters which belong to this group
 * @param {requestCallback} cb - The callback that handles the response
 */
MongoDeployment.prototype.getClusterByReplicaSetId = function ( clusters, cb )
{
  if ( !_.get( clusters, 'length' ) ) {
    return cb( 'Cannot getClusterByReplicaSetId; clusters is invalid: ' + clusters );
  }
  console.log( '2. Get cluster by replicaSetId. clusters.length is ' + clusters.length );

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
  cb( null, clusterId );
};


/**
 * Get cluster's snapshot list
 * API Path: /api/public/v1.0/groups/<group_id>/clusters/<cluster_id>/snapshots
 *
 * @param {string} clusterId - The id of the cluster from which we want snapshots
 * @param {requestCallback} cb - The callback that handles the response
 */
MongoDeployment.prototype.listSnapshotsOfCluster = function ( clusterId, cb )
{
  if ( !clusterId ) {
    return cb( 'Invalid clusterId: ' + clusterId );
  }
  this.config.clusterId = clusterId;
  console.log( '3. List snapshots of cluster. clusterId = ' + clusterId );

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
    if ( err || res.statusCode >= 300 ) {
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
 * @param {Object[]} snapshots - The list of available snapshots for this MongoDB deployment
 * @param {requestCallback} cb - The callback that handles the response
 */
MongoDeployment.prototype.createRestoreJobForLatestSnapshot = function ( snapshots, cb )
{
  var snapshotToDownload = pickObjWithHighestFieldValue( snapshots, 'created.date' );
  if ( !snapshotToDownload ) {
    return cb( 'No snapshots to download; snapshots = ', snapshots );
  }
  console.log( '4. Create restoreJob for latest snapshot. snapshot = ', snapshotToDownload );

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
    if ( err || res.statusCode >= 300 ) {
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
 */
MongoDeployment.prototype.getDownloadInfoFromRestoreJobList = function ( restoreJobs, cb )
{
  const FIVE_MINUTES_IN_SECONDS = 5 * 60;
  var dlCheck;
  var numChecks = 0;  
  var restoreJobUrl = _.get( restoreJobs, 'links[0].href', null );
  var self = this;

  var opts = _.cloneDeep( this.requestOptionsTemplate );
  _.merge( opts, {
    method: 'GET',
    uri: restoreJobUrl
  });
  dlCheck = setInterval( checkIfRestoreJobIsReady, 1000 );

  function checkIfRestoreJobIsReady ( )
  {
    console.log( 'checkIfRestoreJobIsReady' );
    request( opts, function ( err, res, body ) {
      if ( err || res.statusCode >= 300 ) {
        clearInterval( dlCheck );
        return cb( err || 'Bad statusCode: ' + res.statusCode );
      }      
      numChecks++;
      console.log( 'body.results[0].statusName = ', body.results[0].statusName );
      if ( body.results[0].statusName === 'FINISHED' ) 
      {
        clearInterval( dlCheck );
        self.listRestoreJobs( getLatestRestoreJobFromList.bind( null, cb ) );
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
    if ( err || res.statusCode >= 300 ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    console.log( 'restoreJob list = ', JSON.stringify( body, null, 4 ) );
    return cb( err, body );
  }); 
};


/**
 * Utility. Gets the last restoreJob created from a list of restoreJobs
 *
 * @param {requestCallback} cb - The callback that handles the response
 * @param {string}          err - Any error that might have occurred retrieving the list
 * @param {Object[]}        list - An array of restoreJobs belonging to a specific snapshot
 */
function getLatestRestoreJobFromList ( cb, err, list )
{
  console.log( arguments );
  if ( err || !_.get( list, 'results.length') ) {
    return cb( err || 'No restore jobs exist in list: ' + list );
  }

  var url = _.get( list, 'results[0].delivery.url', null );
  var timestamp = _.get( list, 'results[0].timestamp.date', null );
  console.log( 'item = ', JSON.stringify( list.results[0], null, 4 ) );
  var cbObj = { 
    downloadUrl: url, 
    timestamp: timestamp
  };
  cb( err, cbObj );
}


/**
 * Utility. Returns the array object with the single highest value of a particular field
 *
 * @param {array}  arr       - The array we'll iterate
 * @param {string} fieldPath - The path of our field (lodash _.get() syntax allowed)
 * @returns {object}
 *
 * @example
 * // returns { nested: field: 'value' }
 * pickObjWithHighestFieldValue( [ { nested: { field: 'value' } } ], 'nested.field' );
 */
function pickObjWithHighestFieldValue ( arr, fieldPath )
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
}

/**
 * Generic callback syntax for mongo-api-interface.js
 * @callback requestCallback
 * @param {string} errorMessage
 * @param {string} responseData
 */