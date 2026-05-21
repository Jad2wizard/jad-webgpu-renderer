import { Router, Request, Response } from 'express'
import multer from 'multer'
import { eq, and } from 'drizzle-orm'
import { auth } from '../middleware/auth'
import { db } from '../db'
import { projects, datasets } from '../db/schema'
import type { DatasetMeta, DatasetData } from '../../shared/types'

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
	fileFilter: (_req, file, cb) => {
		const allowed = ['.geojson', '.json']
		const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'))
		if (allowed.includes(ext)) {
			cb(null, true)
		} else {
			cb(new Error('仅支持 .geojson 和 .json 文件'))
		}
	},
})

const router = Router()

/**
 * POST /api/projects/:id/datasets
 * 上传 GeoJSON 文件 → 后端解析 → 存储到 datasets 表
 */
router.post(
	'/projects/:id/datasets',
	auth,
	upload.single('file'),
	async (req: Request, res: Response) => {
		try {
			// 验证项目所有权
			const proj = await db()
				.select()
				.from(projects)
				.where(and(eq(projects.id, req.params.id), eq(projects.ownerId, req.userId!)))
				.get()

			if (!proj) {
				return res.status(404).json({ error: '项目不存在' })
			}

			if (!req.file) {
				return res.status(400).json({ error: '请上传 GeoJSON 文件' })
			}

			// 解析 GeoJSON
			const raw = req.file.buffer.toString('utf-8')
			const geojson = JSON.parse(raw)

			if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
				return res.status(400).json({ error: '仅支持 FeatureCollection 格式的 GeoJSON' })
			}

			const features = geojson.features as any[]
			if (features.length === 0) {
				return res.status(400).json({ error: 'GeoJSON 文件为空' })
			}

			// 检测 geometry 类型
			const firstGeom = features[0]?.geometry?.type ?? 'Unknown'

			// 收集属性字段名
			const propKeys = new Set<string>()
			for (const f of features) {
				if (f.properties && typeof f.properties === 'object') {
					Object.keys(f.properties).forEach((k) => propKeys.add(k))
				}
			}
			const propertyFields = [...propKeys]

			// 构建数据行: [[lon, lat, prop1, prop2, ...], ...]
			const data: (number | string)[][] = []
			let minLon = Infinity,
				maxLon = -Infinity
			let minLat = Infinity,
				maxLat = -Infinity

			for (const feature of features) {
				const geom = feature.geometry
				if (!geom) continue

				const props = feature.properties || {}

				if (geom.type === 'Point') {
					const [lon, lat] = geom.coordinates as [number, number]
					const row: (number | string)[] = [lon, lat]
					for (const key of propertyFields) row.push(props[key] ?? '')
					data.push(row)
					if (lon < minLon) minLon = lon
					if (lon > maxLon) maxLon = lon
					if (lat < minLat) minLat = lat
					if (lat > maxLat) maxLat = lat
				} else if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
					const coords: [number, number][] =
						geom.type === 'MultiLineString'
							? (geom.coordinates as [number, number][][]).flat()
							: (geom.coordinates as [number, number][])
					for (const [lon, lat] of coords) {
						const row: (number | string)[] = [lon, lat]
						for (const key of propertyFields) row.push(props[key] ?? '')
						data.push(row)
						if (lon < minLon) minLon = lon
						if (lon > maxLon) maxLon = lon
						if (lat < minLat) minLat = lat
						if (lat > maxLat) maxLat = lat
					}
				}
				// 其他 geometry 类型暂不处理
			}

			if (data.length === 0) {
				return res.status(400).json({
					error: `无法解析 geometry 类型 "${firstGeom}"，仅支持 Point 和 LineString`,
				})
			}

			// 存储到数据库
			const id = crypto.randomUUID()
			await db()
				.insert(datasets)
				.values({
					id,
					projectId: req.params.id,
					name: req.body.name || req.file.originalname,
					originalName: req.file.originalname,
					fileSize: req.file.size,
					featureCount: data.length,
					geometryType: firstGeom,
					extent: JSON.stringify({
						w: minLon,
						s: minLat,
						e: maxLon,
						n: maxLat,
					}),
					propertyFields: JSON.stringify(propertyFields),
					data: JSON.stringify(data),
				})

			res.status(201).json({
				dataset: {
					id,
					name: req.file.originalname,
					featureCount: data.length,
					geometryType: firstGeom,
					extent: { w: minLon, s: minLat, e: maxLon, n: maxLat },
					propertyFields,
				},
			})
		} catch (err: any) {
			if (err instanceof SyntaxError) {
				return res.status(400).json({ error: '文件不是有效的 JSON 格式' })
			}
			console.error('Dataset upload error:', err)
			res.status(500).json({ error: `上传失败：${err.message}` })
		}
	}
)

/**
 * GET /api/datasets/:id/data
 * 获取已解析的数据集数据
 */
router.get('/projects/:projectId/datasets/:id/data', auth, async (req: Request, res: Response) => {
	const ds = await db().select().from(datasets).where(eq(datasets.id, req.params.id)).get()

	if (!ds) {
		return res.status(404).json({ error: '数据集不存在' })
	}

	const result: DatasetData = {
		data: JSON.parse(ds.data),
		extent: ds.extent ? JSON.parse(ds.extent) : null,
		featureCount: ds.featureCount,
		geometryType: ds.geometryType || 'Unknown',
		propertyFields: ds.propertyFields ? JSON.parse(ds.propertyFields) : undefined,
	}

	res.json(result)
})

/**
 * DELETE /api/datasets/:id
 * 删除数据集
 */
router.delete('/projects/:projectId/datasets/:id', auth, async (req: Request, res: Response) => {
	const ds = await db().select().from(datasets).where(eq(datasets.id, req.params.id)).get()

	if (!ds) {
		return res.status(404).json({ error: '数据集不存在' })
	}

	// 验证项目所有权
	const proj = await db()
		.select()
		.from(projects)
		.where(and(eq(projects.id, ds.projectId), eq(projects.ownerId, req.userId!)))
		.get()

	if (!proj) {
		return res.status(403).json({ error: '无权操作' })
	}

	await db().delete(datasets).where(eq(datasets.id, req.params.id))

	res.json({ success: true })
})

export default router
