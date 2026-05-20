import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src'),
			'@shared': resolve(__dirname, 'shared'),
			// map 包的 main 指向 lib/index.js 但实际出口在 lib/application/index.js
			'@webgpu-gmap/map': resolve(__dirname, '../map/lib/application/index.js'),
		},
	},
	server: {
		port: 5173,
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: 'dist/client',
	},
})
