const path = require('path')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')

module.exports = {
	mode: 'development',
	entry: './src/demo.tsx',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js',
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
		plugins: [new TsconfigPathsPlugin()],
	},
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						configFile: path.resolve(__dirname, '../../.babelrc'),
					},
				},
			},
		],
	},
	plugins: [
		new ForkTsCheckerWebpackPlugin({
			async: false,
			typescript: {
				configFile: './tsconfig.json',
			},
		}),
	],
	devtool: 'inline-source-map',
	devServer: {
		static: './dist',
		hot: true,
		port: 4070,
	},
}
