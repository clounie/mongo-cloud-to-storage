# mongo-cloud-to-storage
Streams DB backups from Mongo Cloud Manager to cloud storage using streams

Currently supported storage providers:
 * AWS S3

Requires Node.js `>= v4.0.0`

To use:
 1. Copy `/examples/config.template.js` to `/config.js`
 2. Replace the variables
 3. `node upload-s3.js` or `npm start`