const esbuild = require('esbuild')
const path = require('path')

async function build() {
	try {
		const result = await esbuild.build({
			entryPoints: ['./src/iife-entry.ts'],
			bundle: true,
			outfile: 'dist/map.iife.js',
			format: 'iife',
			globalName: 'GMap',
			platform: 'browser',
			target: 'es2020',
			minify: false,
			sourcemap: true,
			external: ['react', 'react-dom'],
			define: {
				'process.env.NODE_ENV': '"production"',
			},
			resolveExtensions: ['.tsx', '.ts', '.js'],
			// 处理路径别名
			alias: {
				'@map': path.resolve(__dirname, './src'),
			},
			// 处理 TypeScript
			loader: {
				'.ts': 'ts',
				'.tsx': 'tsx',
			},
			// 处理 webgpu-utils
			mainFields: ['module', 'main'],
			conditions: ['import', 'require', 'node', 'default'],
			logLevel: 'info',
			metafile: true,
			write: true,
		})

		console.log('✅ Map IIFE 构建完成')

		// 可选：分析打包结果
		if (result.metafile) {
			const text = await esbuild.analyzeMetafile(result.metafile)
			console.log(text)
		}
	} catch (error) {
		console.error('❌ 构建失败:', error)
		process.exit(1)
	}
}

build()