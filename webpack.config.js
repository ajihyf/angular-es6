const webpack = require('webpack');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');

const env = process.env.NODE_ENV || 'development';

const plugins = [
  new LodashModuleReplacementPlugin({ 'collections': true }),
  new webpack.optimize.OccurenceOrderPlugin()
];

if (env === 'production') {
  plugins.push(new webpack.optimize.UglifyJsPlugin());
}

module.exports = {
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
