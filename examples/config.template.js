module.exports = {
  /**
   * AWS Authentication
   *
   * @param {string} accessKeyId - Used with a secretKey to sign programmatic requests to AWS
   * @param {string} secretKey - Used with an accessKeyId to sign programmatic requests to AWS
   * @param {string} s3BucketName - AWS S3 bucket to which we'll upload the mongo backup
   *
   * Getting your AWS Access Key ID / Secret Access Key:
   * http://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSGettingStartedGuide/AWSCredentials.html
   */
  aws: {
    accessKeyId: '<your AWS access key id>',
    secretKey: '<your AWS secret key',
    s3BucketName: '<your s3 bucket name, with no s3:// prefix>'
  },

  /**
   * Mongo Cloud Manager
   *
   * @param {string} username - Mongo Cloud Manager login
   * @param {string} apiKey - an MCM Public API key (see below)
   * @param {string} groupId - MCM group ID ('Settings' --> 'Group Settings' under your group name)
   * @param {string} replicaSetName - right now support is only for a single replica set; no standalones / shards
   *
   * Create your Public API key here (fill in group_id): https://cloud.mongodb.com/v2/<group_id>#settings/publicApi
   * Auth docs here: https://docs.opsmanager.mongodb.com/current/core/api/#authentication
   */
  mongoCloudManager: {
    username: '<username>',
    apiKey: '<api key>',
    groupId: '<group id>',
    replicaSetName: '<replica set name>'
  }
};