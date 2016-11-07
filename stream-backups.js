module.exports = streamBackups;

/** npm modules */
const _ = require( 'lodash' );
const async = require( 'async' );

// TODO https://github.com/freeall/single-line-log

/** Local modules */ 
const mongoDeployments = [];
const providerInstances = {};
const providerList = require( './providers/providers' );
const MongoDeployment = require( './lib/mongo-deployment' );

/**
 * Initializes deployments/providers, then executes the backups for each mongoDeployment in config
 */
function streamBackups ( )
{
  async.waterfall( [
    initializeDeploymentsAndProviders,
    backupDeployments
  ], function ( err, result ) {
    if ( err ) {
      throw new Error( err );
    }
    console.log( '--Finished Upload--\n\nSummary:' );
    console.log( JSON.stringify( result, null, 4 ) );  
  });
}

/**
 * Creates the deployment and provider objects necessary to run backups
 *
 * @param {object} config - Contains Mongo Cloud Manager + storage provider info;
 *                           defaults to ./config.js if not passed in
 * @param {requestCallback} cb - Callback
 */
function initializeDeploymentsAndProviders ( config, cb )
{
  console.log( '--Initializing deployments and providers--' );
  // Handle config and/or cb not being passed
  if ( typeof config === 'function' ) {
    cb = config;
    config = null;
  }
  cb = cb || function () { };

  // If config DNE, default to ./config.js|json
  try {
    config = config || require( './config' );
  } catch ( e ) {

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
    if ( deploymentConfig.providerInstances && deploymentConfig.providerInstances.length ) {
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
    console.log( '...Initializing providerInstance: ', providerInstanceName );
    providerInstances[providerInstanceName] = new providerList[providerName]( providerConfig );
  });
  cb();
}


/**
 * Streams a backup from Mongo Cloud Manager to the requested storage provider
 */
function backupDeployments ( cb )
{
  console.log( 'backing up each of: ', mongoDeployments );
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
  console.log( 'backing up deployment: ', mongoDeployment );
  // console.log( 'deployment.provi
  async.eachSeries( mongoDeployment.config.providerInstances, function ( providerInstanceName ) {
    console.log( 'backing deployment to provider: ', providerInstanceName );
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
  /**
   * List of tasks to waterfall, each passing its results to the next in line
   *
   * Each task gets passed all arguments from the previous task, except the error.
   * If a function passes an error, the rest are skipped and processFinalResult is called.
   */
  const tasks = [
    mongoDeployment.listClustersOfGroup.bind( mongoDeployment ),
    mongoDeployment.getClusterByReplicaSetId.bind( mongoDeployment ),
    mongoDeployment.listSnapshotsOfCluster.bind( mongoDeployment ),
    mongoDeployment.createRestoreJobForLatestSnapshot.bind( mongoDeployment ),
    mongoDeployment.getDownloadInfoFromRestoreJobList.bind( mongoDeployment ),
    providerInstance.upload,
  ];
  async.waterfall( tasks, cb );  
}


/**
 * Callback for the entire module, if run as part of larger context
 * @callback requestCallback
 * @param {string} errorMessage - Any errors are passed here
 * @param {string} responseData - Summary data from the streaming upload, if successful
 */