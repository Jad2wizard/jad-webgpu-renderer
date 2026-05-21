import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config as dotenvConfig } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载根目录 .env 文件（../../ 即从 packages/web/server 到项目根）
dotenvConfig({ path: resolve(__dirname, '../../../.env') })

export const config = {
	port: parseInt(process.env.PORT || '3000', 10),
	jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
	deepseekApiKey: process.env.OPENAI_API_KEY || '',
	deepseekBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com',
	deepseekModel: process.env.OPENAI_MODEL || 'deepseek-v4-pro',
	nodeEnv: process.env.NODE_ENV || 'development',
	isProduction: process.env.NODE_ENV === 'production',
	packageRoot: resolve(__dirname, '..'),
	clientDistDir: resolve(__dirname, '../dist/client'),
} as const

if (!config.deepseekApiKey) {
	console.warn('[server] 未设置 OPENAI_API_KEY 环境变量，AI 助手功能将不可用')
}
