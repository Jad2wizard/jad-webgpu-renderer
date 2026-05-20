import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const config = {
	port: parseInt(process.env.PORT || '3000', 10),
	jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
	deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
	deepseekBaseUrl: 'https://api.deepseek.com',
	deepseekModel: 'deepseek-v4-pro' as string,
	nodeEnv: process.env.NODE_ENV || 'development',
	isProduction: process.env.NODE_ENV === 'production',
	packageRoot: resolve(__dirname, '..'),
	clientDistDir: resolve(__dirname, '../dist/client'),
} as const

if (!process.env.DEEPSEEK_API_KEY) {
	console.warn('[server] 未设置 DEEPSEEK_API_KEY，AI 助手功能将不可用')
}
