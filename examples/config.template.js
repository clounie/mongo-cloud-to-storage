'use strict';
module.exports = {
  /**
   * Mongo Cloud Manager Deployment
   *
   * Create your Public API key here (fill in group_id): https://cloud.mongodb.com/v2/<group_id>#settings/publicApi
   * Auth docs here: https://docs.opsmanager.mongodb.com/current/core/api/#authentication
   *
   * @param {string}   username - Mongo Cloud Manager login
   * @param {string}   apiKey - an MCM Public API key (see below)
   * @param {string}   groupId - MCM group ID ('Settings' --> 'Group Settings' under your group name)
   * @param {string}   replicaSetName - right now support is only for a single replica set; no standalones / shards
   * @param {string[]} providerInstances - List of providers instances on which to store this deployment's backups
   * @param {string}   clusterId - Depends on groupId + replicaSetName; assigned in mongo-api-interface.listSnapshotsOfCluster
   */
  mongoDeployments: {
    sampleDeployment: {
      username: '<username>',
      apiKey: '<api key>',
      groupId: '<group id>',
      replicaSetName: '<replica set name>',
      providerInstances: [ '<provider>.<provider-instance-name>' ], /** e.g. 'aws.firstAwsProviderInstance' */
      clusterId: null
    }
  },
  providers: {
    /**
     * AWS Authentication
     *
     * Getting your AWS Access Key ID / Secret Access Key:
     * http://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSGettingStartedGuide/AWSCredentials.html     
     *
     * @param {string} accessKeyId - Used with a secretKey to sign programmatic requests to AWS
     * @param {string} secretKey - Used with an accessKeyId to sign programmatic requests to AWS
     * @param {string} s3BucketName - AWS S3 bucket to which we'll upload the mongo backup
     */
    aws: {
      // Provider instance (Provider + provider config)      
      firstAwsProviderInstance: {
        accessKeyId: '<your AWS access key id>',
        secretKey: '<your AWS secret key',
        s3BucketName: '<your s3 bucket name, with no s3:// prefix>'
      },
      myAwsAccount: {
        accessKeyId: '<your AWS access key id>',
        secretKey: '<your AWS secret key',
        s3BucketName: '<your s3 bucket name, with or without the s3:// prefix>'
      }
    }
  }
};