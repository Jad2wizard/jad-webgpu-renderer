import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { resolve, dirname } from 'path'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 项目根目录 (packages/web)
const PACKAGE_ROOT = resolve(__dirname, '../..')

function getDbPath(): string {
	const url = process.env.DATABASE_URL || './data/gmap.db'
	// 相对路径转为基于 package root 的绝对路径
	if (url.startsWith('./') || url.startsWith('../')) {
		return resolve(PACKAGE_ROOT, url)
	}
	return url
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * 初始化数据库连接并执行迁移
 */
export function initDb(): ReturnType<typeof drizzle<typeof schema>> {
	if (_db) return _db

	const dbPath = getDbPath()
	const dbDir = dirname(dbPath)
	mkdirSync(dbDir, { recursive: true })

	const sqlite = new Database(dbPath)
	// 启用 WAL 模式提升并发读性能
	sqlite.pragma('journal_mode = WAL')
	sqlite.pragma('foreign_keys = ON')

	_db = drizzle(sqlite, { schema })

	// 自动建表（开发阶段使用，生产应使用 drizzle-kit migrate）
	createTablesIfNotExists(sqlite)

	return _db
}

/**
 * 开发阶段自动建表
 * 生产环境应使用 drizzle-kit push 或 drizzle-kit migrate
 */
function createTablesIfNotExists(sqlite: Database.Database) {
	sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '未命名项目',
      description TEXT DEFAULT '',
      viewport TEXT NOT NULL DEFAULT '{"center":[116.4,39.9],"zoom":5,"autoFit":true}',
      tile_config TEXT NOT NULL DEFAULT '{"type":"xyz","urlTemplate":"https://tile.openstreetmap.org/{z}/{x}/{y}.png"}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      feature_count INTEGER NOT NULL DEFAULT 0,
      geometry_type TEXT,
      extent TEXT,
      data TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_datasets_project ON datasets(project_id);

    CREATE TABLE IF NOT EXISTS layers (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      dataset_id TEXT REFERENCES datasets(id) ON DELETE SET NULL,
      name TEXT NOT NULL DEFAULT '图层',
      type TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      level INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_layers_project ON layers(project_id);

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '新对话',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      tool_calls TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
  `)
}

/**
 * 获取数据库实例（必须在 initDb() 之后调用）
 */
export function db(): ReturnType<typeof drizzle<typeof schema>> {
	if (!_db) {
		return initDb()
	}
	return _db
}
