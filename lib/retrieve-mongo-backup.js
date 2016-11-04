'use strict';

const _ = require( 'lodash' );
const async = require( 'async' );
const express = require( 'express' );
const request = require( 'request' );
const config = require( '../config' );


// All requests will need these
const optionsTemplate = {
  uri: 'https://cloud.mongodb.com',
  auth: {
    user: config.mongoCloudManager.username,
    pass: config.mongoCloudManager.apiKey,
    sendImmediately: false // Unless this is false, request won't work with digest auth
  },
  headers: {
    'Content-Type': 'application/json'
  }
};

module.exports = getLatestBackup;

function retrieveLatestBackup( config, cb )
{

}

function getLatestBackup( mongoCloudConfig, cb )
{
  // Get group's cluster list:
  getGroupClusters( config.mongoCloudManager.groupId, function ( err, clusters ) {
    if ( err ) {
      return cb( err );
    }
    // Get cluster's snapshot list
    var clusterId = _.get( _.find( clusters, { replicaSetName: config.mongoCloudManager.replicaSetName } ), 'clusterId', null );
    if ( !clusterId ) {
      return cb( 'Cannot find cluster with name: ' + config.mongoCloudManager.replicaSetName );
    }

    getClusterSnapshots( config.mongoCloudManager.groupId, clusterId, function ( err, snapshots ) {
      if ( err || !snapshots || !snapshots.length ) {
        return cb( err || 'No snapshots available: ' + snapshots );
      }
      console.log( 'snapshots[0] = ', JSON.stringify( snapshots[0], null, 4 ) );

      var snapshotToDownload = pickObjWithHighestFieldValue( snapshots, 'created.date' );
      createRestoreJob( config.mongoCloudManager.groupId, clusterId, snapshotToDownload, function ( err, restoreJob ) {
        if ( err || !restoreJob ) {
          return cb( err || 'Unable to create restoreJob' );
        }

        var dlCheck;
        dlCheck = setInterval( function () {
          getDownloadUrlFromRestoreJob( _.get( restoreJob, 'links[0].href', null ), function ( err, statusObj ) {
            console.log( 'err = ', err );
            if ( statusObj.results[0].statusName !== 'IN_PROGRESS' ) { // TODO change to check if complete
              clearInterval( dlCheck );
              listRestoreJobs( config.mongoCloudManager.groupId, clusterId, function ( err, list ) {
                var url = _.get( list, 'results[0].delivery.url', null );
                var timestamp = _.get( list, 'results[0].timestamp.date', null );
                console.log( 'item = ', JSON.stringify( list.results[0], null, 4 ) );
                var cbObj = { 
                  downloadUrl: url, 
                  timestamp: timestamp
                };
                cb( err, cbObj );
              });
            }
          });
        }, 1000 );
      });
    });
  });
}

function listRestoreJobs ( groupId, clusterId, cb )
{
  var restoreJobPath = '/api/public/v1.0/groups/' + groupId + '/clusters/' + clusterId + '/restoreJobs';
  var opts = _.cloneDeep( optionsTemplate );
  opts.method = 'GET';
  opts.uri += restoreJobPath;
  opts.json = true;

  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= 300 ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    return cb( err, body );
  }); 
}

function getDownloadUrlFromRestoreJob ( url, cb )
{
  var opts = _.cloneDeep( optionsTemplate );
  opts.method = 'GET';
  opts.uri = url;
  opts.json = true;
  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= 300 ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    cb( null, body );
  });
}

/**
 * Create a restore job; this generates an http link, which we will use to download the backup
 * Path: /api/public/v1.0/groups/<group_id>/clusters/<cluster_id>/restoreJobs
 */
function createRestoreJob ( groupId, clusterId, snapshot, cb )
{
  var restoreJobPath = '/api/public/v1.0/groups/' + groupId + '/clusters/' + clusterId + '/restoreJobs';
  var opts = _.cloneDeep( optionsTemplate );
  opts.method = 'POST';
  opts.uri += restoreJobPath;
  opts.json = true;
  opts.body = {
    snapshotId: snapshot.id
  };
  console.log( 'uri = ', opts.uri );
  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= 300 ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    return cb( err, body );
  }); 
}

/**
 * Get cluster's snapshot list
 * Path: /api/public/v1.0/groups/<group_id>/clusters/<cluster_id>/snapshots
 */
function getClusterSnapshots ( groupId, clusterId, cb )
{
  if ( !clusterId ) {
    return cb( 'Invalid clusterId: ' + clusterId );
  }

  let clusterPath = '/api/public/v1.0/groups/' + groupId + '/clusters/' + clusterId + '/snapshots';
  let opts = _.cloneDeep( optionsTemplate );

  // Add our method / URI to the basic options
  opts.method = 'GET';
  opts.uri += clusterPath;
  opts.json = true;

  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= 300 ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    let snapshotList = _.get( body, 'results', [] );
    cb( err, snapshotList );
  });
}

/**
 * Get group's cluster list
 * Path: /api/public/v1.0/groups/<group_id>/clusters
 */
function getGroupClusters ( groupId, cb )
{
  if ( !groupId ) {
    return cb( 'Invalid groupId: ' + groupId );
  }

  let clusterPath = '/api/public/v1.0/groups/' + groupId + '/clusters';
  let opts = _.cloneDeep( optionsTemplate );

  // Add our method / URI to the basic options
  opts.method = 'GET';
  opts.uri += clusterPath;
  opts.json = true;

  request( opts, function ( err, res, body ) {
    if ( err || res.statusCode >= 300 ) {
      return cb( err || 'Bad statusCode: ' + res.statusCode );
    }
    let clusterList = [];
    let results = _.get( body, 'results', [] );

    clusterList = _.map( results, function ( cluster ) {
      return {
        clusterName:  cluster.clusterName,
        clusterId: cluster.id,
        replicaSetName: cluster.replicaSetName
      };
    });
    cb( err, clusterList );
  });
}

/**
 * Returns an object from the array whose field has the greatest value
 *
 * @param {array} arr - The array we'll iterate
 * @param {string} fieldPath - The path of our field (lodash _.get() syntax allowed)
 */
function pickObjWithHighestFieldValue ( arr, path )
{
  var safeVal = _.set( {}, path, '0' );
  var currentLatest = '0';
  var latestIdx = -1;
  _.each( arr, function ( val, idx ) {
    var testVal = _.get( val, path, '0' );
    if ( testVal > currentLatest ) {
      currentLatest = testVal;
      latestIdx = idx;
    }
  });
  return _.get( arr, '[' + latestIdx + ']', null );
}