/**
 * 结构化日志工具
 *
 * 输出目标：控制台 + 文件（可选）
 * 日志文件路径：packages/web/server/logs/server-YYYY-MM-DD.log
 *
 * 环境变量：
 *   LOG_LEVEL   — debug | info | warn | error（默认 debug）
 *   LOG_DIR     — 日志文件目录（默认 ./logs，相对于 server 进程 cwd）
 *   LOG_CONSOLE — 是否输出到控制台（默认 true）
 *   LOG_FILE    — 是否输出到文件（默认 true）
 */
import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'debug'
const logToConsole = process.env.LOG_CONSOLE !== 'false'
const logToFile = process.env.LOG_FILE !== 'false'

function shouldLog(level: LogLevel): boolean {
	return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel]
}

function now(): string {
	return new Date().toISOString()
}

/** 当日日志文件路径（懒初始化） */
let _logFilePath: string | null = null

function getLogFilePath(): string | null {
	if (!logToFile) return null
	if (_logFilePath) return _logFilePath

	const logDir = process.env.LOG_DIR || join(process.cwd(), 'logs')
	const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
	const fileName = `server-${today}.log`

	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true })
	}

	_logFilePath = join(logDir, fileName)
	return _logFilePath
}

/** 重置日志文件路径（跨天后调用） */
function refreshLogFilePath() {
	_logFilePath = null
}

function format(level: LogLevel, traceId: string | undefined, message: string, data?: unknown): string {
	const ts = now()
	const trace = traceId ? `[${traceId}]` : '[-]'
	let line = `${ts} ${level.toUpperCase().padEnd(5)} ${trace} ${message}`
	if (data !== undefined) {
		if (typeof data === 'string') {
			line += ` | ${data}`
		} else if (data instanceof Error) {
			line += ` | ${data.message}`
			if (data.stack && currentLevel === 'debug') {
				line += `\n${data.stack}`
			}
		} else {
			try {
				const s = JSON.stringify(data)
				line += ` | ${s.length > 500 ? s.slice(0, 500) + '...' : s}`
			} catch {
				line += ' | [unserializable]'
			}
		}
	}
	return line
}

function writeToFile(line: string) {
	try {
		const fp = getLogFilePath()
		if (!fp) return

		// 检测跨天，切换文件
		const today = new Date().toISOString().slice(0, 10)
		if (!fp.includes(today)) {
			refreshLogFilePath()
		}

		appendFileSync(getLogFilePath()!, line + '\n', 'utf-8')
	} catch {
		// 文件写入失败不影响主流程
	}
}

function output(level: LogLevel, traceId: string | undefined, message: string, data?: unknown) {
	if (!shouldLog(level)) return

	const line = format(level, traceId, message, data)

	if (logToConsole) {
		switch (level) {
			case 'error': console.error(line); break
			case 'warn': console.warn(line); break
			case 'debug': console.debug(line); break
			default: console.info(line)
		}
	}

	if (logToFile) {
		writeToFile(line)
	}
}

export interface Logger {
	debug(msg: string, data?: unknown): void
	info(msg: string, data?: unknown): void
	warn(msg: string, data?: unknown): void
	error(msg: string, data?: unknown): void
}

export function createLogger(traceId?: string): Logger {
	return {
		debug(msg, data?) { output('debug', traceId, msg, data) },
		info(msg, data?) { output('info', traceId, msg, data) },
		warn(msg, data?) { output('warn', traceId, msg, data) },
		error(msg, data?) { output('error', traceId, msg, data) },
	}
}

/** 进程级默认 logger */
export const log = createLogger()
