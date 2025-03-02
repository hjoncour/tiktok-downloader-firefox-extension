const path = require('path');

module.exports = {
  entry: {
    popup: './src/popup.tsx',
    content: './src/content.ts'
  },
  output: {
    filename: '[name].js', // Will output popup.js and content.js in the dist folder
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          'style-loader', // Injects CSS into the DOM
          'css-loader'    // Translates CSS into modules
        ]
      }
    ]
  },
  mode: 'production'
};
