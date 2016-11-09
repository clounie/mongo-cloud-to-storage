var Jasmine = require('jasmine');
var SpecReporter = require('jasmine-spec-reporter');

// Default config
var jasmineSpecReporterConfig = {
  displayStacktrace: 'none',      // (all|specs|summary|none) - display stacktrace for each failed assertion
  displaySuccessesSummary: false, // display summary of all successes after execution
  displayFailuresSummary: true,   // display summary of all failures after execution
  displayPendingSummary: true,    // display summary of all pending specs after execution
  displaySuccessfulSpec: true,    // display each successful spec
  displayFailedSpec: true,        // display each failed spec
  displayPendingSpec: false,      // display each pending spec
  displaySpecDuration: true,     // display each spec duration
  displaySuiteNumber: false,      // display each suite number (hierarchical)
  colors: {
    success: 'green',
    failure: 'red',
    pending: 'yellow'
  },
  prefixes: {
    success: '✓ ',
    failure: '✗ ',
    pending: '* '
  },
  customProcessors: []
}

var jrunner = new Jasmine();
jrunner.configureDefaultReporter({print: 'noop'});    // jasmine < 2.4.1, remove default reporter logs
jrunner.env.clearReporters();                       // jasmine >= 2.5.2, remove default reporter logs
jrunner.addReporter(new SpecReporter( jasmineSpecReporterConfig ));            // add jasmine-spec-reporter
jrunner.loadConfigFile( './test/jasmine-config/jasmine');                           // load jasmine.json configuration
jrunner.execute();