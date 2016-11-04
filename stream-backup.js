const providers = require( './providers/providers' );
const getLatestMongoBackup = require( './lib/retrieve-mongo-backup' );

getLatestMongoBackup( {}, function ( err, backup ) {
	if ( !backup || !backup.downloadUrl || !backup.timestamp ) {
		throw new Error( 'ERROR: Invalid backup. Backup = ' + backup );
	}
	providers.s3.upload( backup.downloadUrl, backup.timestamp );
});