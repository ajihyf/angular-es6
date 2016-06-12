module.exports = function (config) {
  config.set({
    basePath: '..',
    autoWatch: false,
    frameworks: ['mocha'],
    colors: true,
    files: [
      'node_modules/babel-polyfill/dist/polyfill.js',
      {
        pattern: 'test/karma.tests.js',
        watched: false,
        served: true,
        included: true
      }
    ],
    preprocessors: {
      'test/karma.tests.js': ['eslint', 'webpack', 'sourcemap']
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
    singleRun: false,
    webpack: {
      devtool: 'inline-source-map',
      module: {
        loaders: [
          {
            test: /\.js$/,
            loader: 'babel',
            exclude: /node_modules/,
            query: {
              cacheDirectory: true
            }
          }
        ],
        noParse: [
          /node_modules\/sinon\//
        ]
      },
      resolve: {
        alias: {
          sinon: 'sinon/pkg/sinon.js'
        },
        extensions: ['', '.js'],
        modulesDirectories: [
          'node_modules',
          './'
        ]
      }
    },
    webpackServer: {
      noInfo: true
    }
  })
}
