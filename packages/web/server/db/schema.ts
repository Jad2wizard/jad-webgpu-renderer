import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ==================== users ====================

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	name: text('name').notNull().default(''),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
})

// ==================== projects ====================

export const projects = sqliteTable(
	'projects',
	{
		id: text('id').primaryKey(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull().default('未命名项目'),
		description: text('description').default(''),
		viewport: text('viewport')
			.notNull()
			.default('{"center":[116.4,39.9],"zoom":5,"autoFit":true}'),
		tileConfig: text('tile_config')
			.notNull()
			.default(
				'{"type":"xyz","urlTemplate":"https://tile.openstreetmap.org/{z}/{x}/{y}.png"}'
			),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(table) => ({
		ownerIdx: index('idx_projects_owner').on(table.ownerId),
	})
)

// ==================== layers ====================

export const layers = sqliteTable(
	'layers',
	{
		id: text('id').primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		datasetId: text('dataset_id').references(() => datasets.id, { onDelete: 'set null' }),
		name: text('name').notNull().default('图层'),
		type: text('type').notNull(),
		visible: integer('visible').notNull().default(1),
		level: integer('level').notNull().default(0),
		config: text('config').notNull().default('{}'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(datetime('now'))`),
		updatedAt: text('updated_at')
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(table) => ({
		projectIdx: index('idx_layers_project').on(table.projectId),
	})
)

// ==================== datasets ====================

export const datasets = sqliteTable(
	'datasets',
	{
		id: text('id').primaryKey(),
		projectId: text('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		originalName: text('original_name').notNull(),
		fileSize: integer('file_size').notNull().default(0),
		featureCount: integer('feature_count').notNull().default(0),
		geometryType: text('geometry_type'),
		extent: text('extent'),
		data: text('data').notNull().default('[]'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(table) => ({
		projectIdx: index('idx_datasets_project').on(table.projectId),
	})
)

// ==================== chat_sessions ====================

export const chatSessions = sqliteTable('chat_sessions', {
	id: text('id').primaryKey(),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull().default('新对话'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(datetime('now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(datetime('now'))`),
})

// ==================== chat_messages ====================

export const chatMessages = sqliteTable(
	'chat_messages',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => chatSessions.id, { onDelete: 'cascade' }),
		role: text('role').notNull(),
		content: text('content').notNull().default(''),
		toolCalls: text('tool_calls'),
		createdAt: text('created_at')
			.notNull()
			.default(sql`(datetime('now'))`),
	},
	(table) => ({
		sessionIdx: index('idx_chat_messages_session').on(table.sessionId),
	})
)
