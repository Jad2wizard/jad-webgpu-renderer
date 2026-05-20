import { Router, Request, Response } from 'express'
import { eq, and } from 'drizzle-orm'
import { auth } from '../middleware/auth'
import { db } from '../db'
import { projects, layers } from '../db/schema'
import type { ScatterStyleConfig, PathStyleConfig, HeatmapStyleConfig } from '../../shared/types'
import { defaultScatterStyle, defaultPathStyle, defaultHeatmapStyle } from '../../shared/types'

const router = Router()

/**
 * POST /api/projects/:id/layers
 * 在项目中添加新图层
 */
router.post('/projects/:id/layers', auth, async (req: Request, res: Response) => {
	// 验证项目所有权
	const proj = await db()
		.select()
		.from(projects)
		.where(and(eq(projects.id, req.params.id), eq(projects.ownerId, req.userId!)))
		.get()

	if (!proj) {
		return res.status(404).json({ error: '项目不存在' })
	}

	const { name, type, datasetId, fields } = req.body
	if (!type || !datasetId || !fields) {
		return res.status(400).json({ error: 'type、datasetId、fields 为必填项' })
	}

	if (!['scatter', 'path', 'heatmap'].includes(type)) {
		return res.status(400).json({ error: `不支持的图层类型: ${type}` })
	}

	// 生成默认样式
	let defaultStyle: ScatterStyleConfig | PathStyleConfig | HeatmapStyleConfig
	switch (type) {
		case 'scatter':
			defaultStyle = { ...defaultScatterStyle }
			break
		case 'path':
			defaultStyle = { ...defaultPathStyle }
			break
		case 'heatmap':
			defaultStyle = { ...defaultHeatmapStyle }
			break
	}

	// 计算新的 level（比现有最大 level + 1）
	const existingLayers = await db()
		.select({ level: layers.level })
		.from(layers)
		.where(eq(layers.projectId, req.params.id))
		.all()

	const maxLevel = existingLayers.reduce((max, l) => Math.max(max, l.level), -1)
	const newLevel = maxLevel + 1

	const id = crypto.randomUUID()
	const config = {
		id,
		name: name || '图层',
		type,
		visible: true,
		level: newLevel,
		datasetId,
		fields,
		style: defaultStyle,
	}

	await db()
		.insert(layers)
		.values({
			id,
			projectId: req.params.id,
			datasetId,
			name: name || '图层',
			type,
			visible: 1,
			level: newLevel,
			config: JSON.stringify(config),
		})

	res.status(201).json({ layer: config })
})

/**
 * PUT /api/projects/:id/layers/:layerId
 * 更新图层配置（样式、可见性、排序等）
 */
router.put('/projects/:id/layers/:layerId', auth, async (req: Request, res: Response) => {
	// 验证项目所有权
	const proj = await db()
		.select()
		.from(projects)
		.where(and(eq(projects.id, req.params.id), eq(projects.ownerId, req.userId!)))
		.get()

	if (!proj) {
		return res.status(404).json({ error: '项目不存在' })
	}

	const layer = await db()
		.select()
		.from(layers)
		.where(and(eq(layers.id, req.params.layerId), eq(layers.projectId, req.params.id)))
		.get()

	if (!layer) {
		return res.status(404).json({ error: '图层不存在' })
	}

	const currentConfig = JSON.parse(layer.config)
	const updates: Record<string, unknown> = {}

	// 合并样式更新
	if (req.body.style) {
		currentConfig.style = { ...currentConfig.style, ...req.body.style }
	}
	// 合并其他字段
	if (req.body.name !== undefined) {
		currentConfig.name = req.body.name
		updates.name = req.body.name
	}
	if (req.body.visible !== undefined) {
		currentConfig.visible = req.body.visible
		updates.visible = req.body.visible ? 1 : 0
	}
	if (req.body.level !== undefined) {
		currentConfig.level = req.body.level
		updates.level = req.body.level
	}

	updates.config = JSON.stringify(currentConfig)

	await db().update(layers).set(updates).where(eq(layers.id, req.params.layerId))

	res.json({ layer: currentConfig })
})

/**
 * DELETE /api/projects/:id/layers/:layerId
 * 删除图层
 */
router.delete('/projects/:id/layers/:layerId', auth, async (req: Request, res: Response) => {
	const proj = await db()
		.select()
		.from(projects)
		.where(and(eq(projects.id, req.params.id), eq(projects.ownerId, req.userId!)))
		.get()

	if (!proj) {
		return res.status(404).json({ error: '项目不存在' })
	}

	await db()
		.delete(layers)
		.where(and(eq(layers.id, req.params.layerId), eq(layers.projectId, req.params.id)))

	res.json({ success: true })
})

export default router
