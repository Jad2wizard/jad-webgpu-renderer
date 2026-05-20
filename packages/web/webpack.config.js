const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')

module.exports = {
	mode: 'development',
	entry: './src/main.ts',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js',
		clean: true,
	},
	resolve: {
		symlinks: false,
		extensions: ['.ts', '.tsx', '.js', '.vue'],
		plugins: [new TsconfigPathsPlugin()],
		fallback: {
			buffer: require.resolve('buffer/'),
		},
		alias: {
			'@': path.resolve(__dirname, 'src'),
			'@shared': path.resolve(__dirname, 'shared'),
			'@webgpu-gmap/map': path.resolve(__dirname, '../map/lib/application/index.js'),
			// map 包 CJS 编译输出中的 @map/* 路径别名
			'@map/application': path.resolve(__dirname, '../map/lib/application'),
			'@map/types': path.resolve(__dirname, '../map/lib/types.js'),
			'@map/utils': path.resolve(__dirname, '../map/lib/utils'),
			'@map/spatial': path.resolve(__dirname, '../map/lib/spatial'),
		},
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				use: 'vue-loader',
			},
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: {
					loader: 'ts-loader',
					options: {
						transpileOnly: true,
						appendTsSuffixTo: [/\.vue$/],
					},
				},
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader', 'postcss-loader'],
			},
		],
	},
	plugins: [
		new VueLoaderPlugin(),
		new HtmlWebpackPlugin({
			template: './index.html',
		}),
		// ForkTsCheckerWebpackPlugin 在 workspace monorepo 中与跨包类型解析有兼容问题，
		// 类型检查由 IDE 和 vue-tsc 负责，构建时仅使用 ts-loader transpileOnly 模式
	],
	devtool: 'inline-source-map',
	devServer: {
		static: './dist',
		hot: true,
		port: 4080,
		proxy: [
			{
				context: ['/api'],
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
		],
	},
}
