import express from 'express'
import cors from 'cors'
import { initDb } from './db'
import { config } from './config'
import { trace } from './middleware/trace'
import authRoutes from './routes/auth'
import projectRoutes from './routes/projects'
import layerRoutes from './routes/layers'
import datasetRoutes from './routes/datasets'
import chatRoutes from './routes/chat'

/**
 * 创建 Express 应用实例
 *
 * 设计说明：
 * - 所有路由都按资源拆分（auth, projects, layers, datasets, chat）
 * - 鉴权中间件在各路由文件内部按需应用（公开接口不加 auth，保护接口加）
 * - 生产环境托管前端构建产物，开发环境前端由 Vite 独立运行
 */
export async function createServer() {
	// 初始化数据库（自动建表）
	initDb()

	const app = express()

	// ---- 全局中间件 ----
	app.use(trace)
	app.use(
		cors({
			origin: config.isProduction ? false : 'http://localhost:4080',
			credentials: true,
		})
	)
	app.use(express.json({ limit: '50mb' }))

	// ---- API 路由 ----
	app.use('/api', authRoutes) // /api/auth/login, /api/auth/register
	app.use('/api', projectRoutes) // /api/projects, /api/projects/:id
	app.use('/api', layerRoutes) // /api/projects/:id/layers, ...
	app.use('/api', datasetRoutes) // /api/projects/:id/datasets, /api/projects/:pid/datasets/:id/data
	app.use('/api', chatRoutes) // /api/chat, /api/chat/sessions, ...

	// ---- 生产环境：托管前端静态文件 ----
	if (config.isProduction) {
		app.use(express.static(config.clientDistDir))
		// SPA fallback：所有非 API 请求返回 index.html
		app.get('*', (_req, res) => {
			res.sendFile(`${config.clientDistDir}/index.html`)
		})
	}

	return app
}
