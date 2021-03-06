'use strict';
module.exports = streamBackups;

/** npm modules */
const _ = require( 'lodash' );
const async = require( 'async' );
const debug = require( 'debug' )( 'stream-backups' );

// TODO https://github.com/freeall/single-line-log

/** Local modules */ 
const mongoDeployments = [];
const providerInstances = {};
const providerList = require( './providers/providers' );
const MongoDeployment = require( './lib/mongo-deployment' );

/**
 * Initializes deployments/providers, then executes the backups for each mongoDeployment in config
 *
 * @param {string|Object} config - Contains Mongo Cloud Manager + storage provider info;
 * @param {requestCallback} cb - Callback
 * @returns {?function} - returnCallback if there's an error, otherwise doesn't return
 */
function streamBackups ( config, cb )
{
  if ( typeof config === 'function' ) {
    cb = config;
    config = null;
  }
  cb = cb || function ( e ) { throw new Error( e ); };

  // Let them pass in a string filepath if they want
  if ( _.isString( config ) ) {
    try {
      config = require( config );
    } catch ( e ) {
      return cb( e );
    }
  }

  async.waterfall( [
    initializeDeploymentsAndProviders.bind( null, config ),
    backupDeployments
  ], function ( err/*, result*/ ) {
    if ( err )
    {
      if ( cb ) {
        return cb( err );
      }
      throw new Error( err );
    }
    debug( '--Finished Upload--' );
    // debug( JSON.stringify( result, null, 4 ) );
  });
}

/**
 * Creates the deployment and provider objects necessary to run backups
 *
 * @param {Object} config - Contains Mongo Cloud Manager + storage provider info;
 *                           defaults to ./config.js if not passed in
 * @param {requestCallback} cb - Callback
 * @returns {?function} - returnCallback if there's an error, otherwise doesn't return 
 */
function initializeDeploymentsAndProviders ( config, cb )
{
  debug( 'I. Initializing deployments and providers--' );
  // Handle config and/or cb not being passed
  if ( typeof config === 'function' ) {
    cb = config;
    config = null;
  }
  cb = cb || function (e) { throw new Error( e ); };

  // If config DNE, default to ./config.js|json
  try {
    config = config || require( './config' );
  } catch ( e ) {
    return cb( e );   
  }

  // Error upon bad config
  if ( typeof config !== 'object' || 
       !config.providers || 
       !config.mongoDeployments ||
       !_.get( _.keys( config.mongoDeployments ), 'length' ) ) {
    return cb( 'Invalid config object: ' + config );
  }

  var masterProviderList = [];
  // 1. Create a MongoDeployment instance for each deployment in the config
  //    ..but only if it has providers attached, to which we can upload files
  _.forOwn( config.mongoDeployments, function ( deploymentConfig ) {
    if ( deploymentConfig.providerInstances && deploymentConfig.providerInstances.length ) 
    {
      var validProviders = _.filter( deploymentConfig.providerInstances, _.isString );
      mongoDeployments.push( new MongoDeployment().init( deploymentConfig ) );
      masterProviderList = masterProviderList.concat( validProviders );
    }
  });

  masterProviderList = _.uniq( masterProviderList ); // We only need one of each

  // 2. Create a Provider instance for each provider in the masterProviderList
  _.each( masterProviderList, function ( providerInstanceName )
  {
    // a) Get the provider name (e.g. 'aws' from 'aws.username')
    let dotIndex = providerInstanceName.indexOf( '.' );
    if ( dotIndex === -1 ) {
      return cb( 'Error: providerInstanceName of ' + providerInstanceName + ' is invalid.' );
    }

    // b) Validate the providerName
    let providerName = providerInstanceName.substring( 0, dotIndex );
    if ( !_.isString( providerName ) || !providerName.length ) {
      return cb( 'Invalid providerName: ' + providerName );
    }

    // c) Get the config for this ProviderInstance
    let providerConfig = _.get( config.providers, providerInstanceName );
    if ( !providerConfig ) {
      return cb( 'providerConfig for providerInstanceName of: ' + providerInstanceName + ' does not exist.' );
    }

    // d) Initialize the ProviderInstance
    providerInstances[providerInstanceName] = new providerList[providerName]().init( providerConfig );
    debug( ' * Initialized providerInstance: ', providerInstanceName );
  });
  cb();
}


/**
 * Streams a backup from Mongo Cloud Manager to the requested storage provider
 * @param {requestCallback} cb - Callback 
 */
function backupDeployments ( cb )
{
  debug( '\nII. Backing up deployments; backing up a total of ' + mongoDeployments.length + ' deployments' );
  async.eachSeries( mongoDeployments, backupDeployment, cb );
}


/**
 * Backs up the deployment to each of its specified providers
 *
 * @param {MongoDeployment} mongoDeployment - The deployment to backup
 * @param {requestCallback} cb - Callback
 */
function backupDeployment ( mongoDeployment, cb )
{
  // debug( 'deployment.provi
  async.eachSeries( mongoDeployment.config.providerInstances, function ( providerInstanceName ) {
    debug( '  Currently sending backups for deployment with username [' +
                 mongoDeployment.config.username + 
                 '] to provider: [' +
                 providerInstanceName + ']' );
    backupDeploymentToProvider( 
      mongoDeployment, 
      providerInstances[providerInstanceName], 
      cb 
    );
  });  
}


/**
 * Backs up the MongoDeployment's data to the specified provider
 *
 * @param {MongoDeployment}  mongoDeployment - The deployment to backup
 * @param {ProviderInstance} providerInstance - The provider+credentials where we'll store the backup
 * @param {requestCallback}  cb - Callback
 */
function backupDeploymentToProvider ( mongoDeployment, providerInstance, cb )
{
  const tasks = [
    mongoDeployment.getDownloadAndUploadInfo.bind( mongoDeployment ),
    providerInstance.upload.bind( providerInstance )
  ];
  async.waterfall( tasks, cb );  
}


/**
 * Callback for the entire module, if run as part of larger context
 * @callback requestCallback
 * @param {string} errorMessage - Any errors are passed here
 * @param {string} responseData - Summary data from the streaming upload, if successful
 */