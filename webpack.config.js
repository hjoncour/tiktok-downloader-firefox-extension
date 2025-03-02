const path = require('path');

module.exports = {
  entry: './src/popup.tsx',
  output: {
    filename: 'popup.js',
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
          'style-loader',  // 1) Injects CSS into the DOM
          'css-loader'     // 2) Turns CSS into valid JS modules
        ]
      }
    ]
  },
  mode: 'production'
};
