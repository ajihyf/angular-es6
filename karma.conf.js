const webpackConfig = require('./webpack.config.js');

module.exports = function (config) {
  config.set({
    basePath: '.',
    autoWatch: false,
    frameworks: ['mocha'],
    colors: true,
    client: {
      captureConsole: false
    },
    files: [
      'node_modules/babel-polyfill/dist/polyfill.js',
      {
        pattern: 'test/test.index.js',
        watched: false,
        served: true,
        included: true
      }
    ],
    preprocessors: {
      'test/test.index.js': ['webpack', 'sourcemap']
    },
    browsers: ['PhantomJS'],
    plugins: [
      'karma-phantomjs-launcher',
      'karma-mocha',
      'karma-sourcemap-loader',
      'karma-webpack',
      'karma-mocha-reporter'
    ],
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,
    port: 9876,
    reporters: ['mocha'],
    // reporter options
    mochaReporter: {
      output: 'autowatch'
    },
    singleRun: false,
    webpack: webpackConfig,
    webpackServer: {
      noInfo: true
    }
  });
};
