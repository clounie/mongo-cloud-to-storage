function Provider ( )
{
}

Provider.prototype.init = function ( initConfig )
{
  this.config = initConfig;
};
module.exports = Provider;

// ------------


var Provider = require('../provider-template');

function Downloader ( currentRequests )
{
  this.TIMEOUT = 60000;
  // etc
}
require('util').inherits(Downloader, Provider);

Downloader.prototype.download = function ( req )
{
  // ...
}