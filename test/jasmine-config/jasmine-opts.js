module.exports = {
  "spec_dir": "test",
  "spec_files": [
    "test-*.js",
    "**/test-*.js"
  ],
  "helpers": [
    "../node_modules/jasmine-expect/index.js", // jasmine-expect
    "helpers/**/*.js" // any custom helpers we need
  ],
  "stopSpecOnExpectationFailure": true,
  "random": false
};