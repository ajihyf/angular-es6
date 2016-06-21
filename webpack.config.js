const webpack = require('webpack');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');

const env = process.env.NODE_ENV || 'development';

const plugins = [
  new webpack.optimize.DedupePlugin(),
  new webpack.optimize.OccurenceOrderPlugin(),
  new LodashModuleReplacementPlugin({
    'collections': true,
    'flattening': true
  })
];

if (env === 'production') {
  plugins.push(new webpack.optimize.UglifyJsPlugin());
}

let config;
if (env === 'test') {
  config = {
    devtool: 'inline-source-map',
    plugins: plugins,
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
      ]
    },
    resolve: {
      extensions: ['', '.js'],
      modulesDirectories: [
        'node_modules'
      ]
    }
  };
} else {
  config = {
    devtool: 'source-map',
    module: {
      loaders: [
        {
          test: /\.js$/,
          loaders: ['babel'],
          exclude: /node_modules/
        }
      ]
    },
    plugins: plugins
  };
}

module.exports = config;
