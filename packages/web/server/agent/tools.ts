import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { projects, layers } from '../db/schema'
import { defaultScatterStyle, defaultHeatmapStyle } from '../../shared/types'

// ==================== 查询工具 ====================

export const getCurrentConfig = tool(
	async ({ projectId }) => {
		const proj = await db().select().from(projects).where(eq(projects.id, projectId)).get()
		if (!proj) return '错误：项目不存在'

		const layerList = await db()
			.select()
			.from(layers)
			.where(eq(layers.projectId, projectId))
			.all()

		const config = {
			viewport: JSON.parse(proj.viewport),
			tile: JSON.parse(proj.tileConfig),
			layers: layerList.map((l) => ({
				id: l.id,
				name: l.name,
				type: l.type,
				visible: !!l.visible,
				level: l.level,
				config: JSON.parse(l.config),
			})),
		}
		return JSON.stringify(config, null, 2)
	},
	{
		name: 'get_current_config',
		description: '获取当前项目的完整地图配置。在修改任何配置之前先调用此工具了解当前状态。',
		schema: z.object({
			projectId: z.string().describe('项目 ID'),
		}),
	}
)

export const listLayers = tool(
	async ({ projectId }) => {
		const layerList = await db()
			.select({
				id: layers.id,
				name: layers.name,
				type: layers.type,
				visible: layers.visible,
				level: layers.level,
			})
			.from(layers)
			.where(eq(layers.projectId, projectId))
			.all()

		return JSON.stringify(layerList.map((l) => ({ ...l, visible: !!l.visible })))
	},
	{
		name: 'list_layers',
		description: '列出当前项目的所有图层及其基本信息。当用户没有指定要修改哪个图层时使用。',
		schema: z.object({
			projectId: z.string().describe('项目 ID'),
		}),
	}
)

// ==================== 视口工具 ====================

export const setViewportCenter = tool(
	async ({ projectId, center, zoom }) => {
		const proj = await db().select().from(projects).where(eq(projects.id, projectId)).get()
		if (!proj) return '错误：项目不存在'

		const vp = JSON.parse(proj.viewport)
		vp.center = center
		if (zoom !== null && zoom !== undefined) vp.zoom = Math.max(1, Math.min(18, zoom))

		await db()
			.update(projects)
			.set({ viewport: JSON.stringify(vp) })
			.where(eq(projects.id, projectId))

		return zoom !== null && zoom !== undefined
			? `已设置中心点为 [${center[0]}, ${center[1]}]，缩放级别 ${vp.zoom}`
			: `已设置中心点为 [${center[0]}, ${center[1]}]`
	},
	{
		name: 'set_viewport_center',
		description: "设置地图的中心点。用户说'定位到北京'、'移动到上海'时调用。",
		schema: z.object({
			projectId: z.string(),
			center: z.array(z.number()).length(2).describe('[longitude, latitude]'),
			zoom: z.number().min(1).max(18).optional().describe('缩放级别，不传则不修改'),
		}),
	}
)

export const setViewportZoom = tool(
	async ({ projectId, zoom }) => {
		const proj = await db().select().from(projects).where(eq(projects.id, projectId)).get()
		if (!proj) return '错误：项目不存在'

		const vp = JSON.parse(proj.viewport)
		vp.zoom = Math.max(1, Math.min(18, zoom))

		await db()
			.update(projects)
			.set({ viewport: JSON.stringify(vp) })
			.where(eq(projects.id, projectId))

		return `已设置缩放级别为 ${vp.zoom}`
	},
	{
		name: 'set_viewport_zoom',
		description: "设置地图缩放级别。用户说'放大'、'缩小'时调用。",
		schema: z.object({
			projectId: z.string(),
			zoom: z.number().min(1).max(18).describe('缩放级别 1-18'),
		}),
	}
)

// ==================== 样式工具：通用 ====================

export const setColor = tool(
	async ({ projectId, layerId, color, colorRole }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`

		const config = JSON.parse(layer.config)
		config.style ??= {}

		const styleKey =
			colorRole === 'main'
				? 'color'
				: colorRole === 'head'
					? 'headPointColor'
					: 'unplayedColor'
		config.style[styleKey] = color

		await db()
			.update(layers)
			.set({ config: JSON.stringify(config) })
			.where(eq(layers.id, layerId))

		const roleLabel =
			colorRole === 'main' ? '主' : colorRole === 'head' ? '头部指示点' : '未播放部分'
		return `已将"${layer.name}"的${roleLabel}颜色更新为 [${color.join(', ')}]`
	},
	{
		name: 'set_color',
		description:
			"设置图层的颜色。用户说'改成红色'、'换成蓝色'时调用。颜色格式 [r, g, b, a]，分量 0-1。红色=[1,0,0,1]，蓝色=[0,0,1,1]。",
		schema: z.object({
			projectId: z.string(),
			layerId: z.string().describe('图层 ID'),
			color: z.array(z.number().min(0).max(1)).length(4).describe('[r, g, b, a]，分量 0-1'),
			colorRole: z.enum(['main', 'head', 'unplayed']).default('main').describe('颜色用途'),
		}),
	}
)

export const setRadius = tool(
	async ({ projectId, layerId, radius }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`

		if (layer.type !== 'scatter' && layer.type !== 'heatmap') {
			return `错误：set_radius 仅适用于 scatter 和 heatmap 图层，当前图层类型为 ${layer.type}`
		}

		const config = JSON.parse(layer.config)
		config.style ??= {}
		config.style.radius = Math.max(1, Math.min(255, radius))

		await db()
			.update(layers)
			.set({ config: JSON.stringify(config) })
			.where(eq(layers.id, layerId))

		return `已将"${layer.name}"的半径更新为 ${config.style.radius} 像素`
	},
	{
		name: 'set_radius',
		description:
			"设置散点或热力图的点半径。用户说'点大一点'、'半径改成 10'时调用。仅适用于 scatter 和 heatmap 图层。",
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
			radius: z.number().min(1).max(255).describe('半径（像素）'),
		}),
	}
)

export const setBlendingMode = tool(
	async ({ projectId, layerId, mode }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`

		const config = JSON.parse(layer.config)
		config.style ??= {}
		config.style.blending = mode

		await db()
			.update(layers)
			.set({ config: JSON.stringify(config) })
			.where(eq(layers.id, layerId))

		const modeLabels: Record<string, string> = {
			normalBlending: '正常',
			additiveBlending: '叠加增亮',
			subtractiveBlending: '相减变暗',
		}
		return `已将"${layer.name}"的混合模式更新为 ${modeLabels[mode] || mode}`
	},
	{
		name: 'set_blending_mode',
		description:
			'设置图层的混合模式。normalBlending=正常默认、additiveBlending=叠加增亮、subtractiveBlending=相减变暗。',
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
			mode: z.enum(['normalBlending', 'additiveBlending', 'subtractiveBlending']),
		}),
	}
)

// ==================== 样式工具：类型专用 ====================

export const setScatterStyle = tool(
	async ({ projectId, layerId, color, radius, blending }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`
		if (layer.type !== 'scatter') return '错误：此工具仅适用于 scatter 图层'

		const config = JSON.parse(layer.config)
		config.style ??= {}
		if (color) config.style.color = color
		if (radius !== undefined && radius !== null)
			config.style.radius = Math.max(1, Math.min(255, radius))
		if (blending) config.style.blending = blending

		await db()
			.update(layers)
			.set({ config: JSON.stringify(config) })
			.where(eq(layers.id, layerId))

		return `已更新散点图层"${layer.name}"的样式`
	},
	{
		name: 'set_scatter_style',
		description: '设置散点图层的样式。只传需要修改的字段，未传字段保持不变。',
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
			color: z.array(z.number().min(0).max(1)).length(4).optional(),
			radius: z.number().min(1).max(255).optional(),
			blending: z
				.enum(['normalBlending', 'additiveBlending', 'subtractiveBlending'])
				.optional(),
		}),
	}
)

export const setScatterDataMapping = tool(
	async ({ projectId, layerId, colorMapping, radiusMapping, clearColorMapping, clearRadiusMapping }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`
		if (layer.type !== 'scatter') return '错误：此工具仅适用于 scatter 图层'

		const config = JSON.parse(layer.config)
		config.style ??= {}

		// 处理颜色映射
		if (clearColorMapping) {
			delete config.style.colorMapping
		} else if (colorMapping) {
			config.style.colorMapping = {
				r: colorMapping.r,
				g: colorMapping.g,
				b: colorMapping.b,
				a: colorMapping.a,
			}
			if (colorMapping.range) {
				config.style.colorMapping.range = colorMapping.range
			}
		}

		// 处理半径映射
		if (clearRadiusMapping) {
			delete config.style.radiusMapping
		} else if (radiusMapping) {
			config.style.radiusMapping = {
				field: radiusMapping.field,
			}
			if (radiusMapping.range) {
				config.style.radiusMapping.range = radiusMapping.range
			}
		}

		await db()
			.update(layers)
			.set({ config: JSON.stringify(config) })
			.where(eq(layers.id, layerId))

		const parts: string[] = []
		if (clearColorMapping) parts.push('已清除颜色映射')
		else if (colorMapping) parts.push(`已设置颜色映射（R:列${colorMapping.r}, G:列${colorMapping.g}, B:列${colorMapping.b}, A:列${colorMapping.a}）`)
		if (clearRadiusMapping) parts.push('已清除半径映射')
		else if (radiusMapping) parts.push(`已设置半径映射（列${radiusMapping.field}）`)

		return `散点图层"${layer.name}"：${parts.join('，')}`
	},
	{
		name: 'set_scatter_data_mapping',
		description:
			'设置散点图层的数据映射，将数据列映射到颜色通道（RGBA）或半径。数据映射的优先级高于图层默认颜色/半径设置。用户说"根据某列数据设置颜色"、"用第X列映射半径"、"让颜色由数据驱动"时调用。colorMapping 中 r/g/b/a 均为数据列索引（从0开始），range 为可选的归一化范围 [min, max]。radiusMapping 中 field 为数据列索引。',
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
			colorMapping: z
				.object({
					r: z.number().describe('红色通道对应的数据列索引（0-based）'),
					g: z.number().describe('绿色通道对应的数据列索引'),
					b: z.number().describe('蓝色通道对应的数据列索引'),
					a: z.number().describe('透明度通道对应的数据列索引'),
					range: z
						.tuple([z.number(), z.number()])
						.optional()
						.describe('归一化范围 [min, max]，不传则自动推断'),
				})
				.optional(),
			radiusMapping: z
				.object({
					field: z.number().describe('半径值对应的数据列索引'),
					range: z
						.tuple([z.number(), z.number()])
						.optional()
						.describe('半径值范围 [min, max]（像素），不传则 1-255'),
				})
				.optional(),
			clearColorMapping: z.boolean().optional().describe('是否清除已有的颜色映射'),
			clearRadiusMapping: z.boolean().optional().describe('是否清除已有的半径映射'),
		}),
	}
)

export const setPathStyle = tool(
	async ({
		projectId,
		layerId,
		color,
		lineWidth,
		headPointVisible,
		headPointColor,
		headPointSize,
		trailDuration,
		unplayedColor,
		unplayedLineWidth,
		blending,
	}) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`
		if (layer.type !== 'path') return '错误：此工具仅适用于 path 图层'

		const config = JSON.parse(layer.config)
		config.style ??= {}
		if (color) config.style.color = color
		if (lineWidth !== undefined && lineWidth !== null)
			config.style.lineWidth = Math.max(1, lineWidth)
		if (headPointVisible !== undefined && headPointVisible !== null)
			config.style.headPointVisible = headPointVisible
		if (headPointColor) config.style.headPointColor = headPointColor
		if (headPointSize !== undefined && headPointSize !== null)
			config.style.headPointSize = Math.max(1, headPointSize)
		if (trailDuration !== undefined && trailDuration !== null)
			config.style.trailDuration = Math.max(0, trailDuration)
		if (unplayedColor) config.style.unplayedColor = unplayedColor
		if (unplayedLineWidth !== undefined && unplayedLineWidth !== null)
			config.style.unplayedLineWidth = Math.max(1, unplayedLineWidth)
		if (blending) config.style.blending = blending

		await db()
			.update(layers)
			.set({ config: JSON.stringify(config) })
			.where(eq(layers.id, layerId))

		return `已更新轨迹图层"${layer.name}"的样式`
	},
	{
		name: 'set_path_style',
		description: '设置轨迹图层的样式。只传需要修改的字段。',
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
			color: z.array(z.number().min(0).max(1)).length(4).optional(),
			lineWidth: z.number().min(1).optional(),
			headPointVisible: z.boolean().optional(),
			headPointColor: z.array(z.number().min(0).max(1)).length(4).optional(),
			headPointSize: z.number().min(1).optional(),
			trailDuration: z.number().min(0).optional().describe('拖尾持续时间（秒）'),
			unplayedColor: z.array(z.number().min(0).max(1)).length(4).optional(),
			unplayedLineWidth: z.number().min(1).optional(),
			blending: z
				.enum(['normalBlending', 'additiveBlending', 'subtractiveBlending'])
				.optional(),
		}),
	}
)

export const setHeatmapStyle = tool(
	async ({ projectId, layerId, colorList, blur, radius, blending }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`
		if (layer.type !== 'heatmap') return '错误：此工具仅适用于 heatmap 图层'

		const config = JSON.parse(layer.config)
		config.style ??= {}
		if (colorList) config.style.colorList = colorList
		if (blur !== undefined && blur !== null) config.style.blur = Math.max(0, Math.min(1, blur))
		if (radius !== undefined && radius !== null)
			config.style.radius = Math.max(1, Math.min(255, radius))
		if (blending) config.style.blending = blending

		await db()
			.update(layers)
			.set({ config: JSON.stringify(config) })
			.where(eq(layers.id, layerId))

		return `已更新热力图图层"${layer.name}"的样式`
	},
	{
		name: 'set_heatmap_style',
		description:
			'设置热力图层的样式。颜色调色板 colorList 是 5 个 [r,g,b,a] 颜色数组，从高密度到低密度排列。',
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
			colorList: z
				.array(z.array(z.number().min(0).max(1)).length(4))
				.length(5)
				.optional(),
			blur: z.number().min(0).max(1).optional().describe('模糊系数 0-1'),
			radius: z.number().min(1).max(255).optional(),
			blending: z
				.enum(['normalBlending', 'additiveBlending', 'subtractiveBlending'])
				.optional(),
		}),
	}
)

// ==================== 图层管理工具 ====================

export const toggleLayerVisibility = tool(
	async ({ projectId, layerId }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`

		const newVisible = layer.visible === 1 ? 0 : 1
		await db().update(layers).set({ visible: newVisible }).where(eq(layers.id, layerId))

		return `已将"${layer.name}"${newVisible ? '显示' : '隐藏'}`
	},
	{
		name: 'toggle_layer_visibility',
		description: "切换图层的可见性。用户说'隐藏某某图层'、'显示某某图层'时调用。",
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
		}),
	}
)

export const reorderLayer = tool(
	async ({ projectId, layerId, newLevel }) => {
		await db().update(layers).set({ level: newLevel }).where(eq(layers.id, layerId))

		return '已调整图层顺序'
	},
	{
		name: 'reorder_layer',
		description: '调整图层渲染顺序。数值越大越在上层。',
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
			newLevel: z.number().describe('新的渲染优先级'),
		}),
	}
)

export const removeLayer = tool(
	async ({ projectId, layerId }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`

		await db().delete(layers).where(eq(layers.id, layerId))

		return `已删除图层"${layer.name}"`
	},
	{
		name: 'remove_layer',
		description: '删除图层。此操作不可逆！仅当用户明确要求删除时调用。',
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
		}),
	}
)

export const convertLayerType = tool(
	async ({ projectId, layerId, targetType }) => {
		const layer = await db().select().from(layers).where(eq(layers.id, layerId)).get()
		if (!layer) return `错误：图层 ${layerId} 不存在`
		if (layer.type !== 'scatter' && layer.type !== 'heatmap') {
			return `错误：此工具仅适用于 scatter 和 heatmap 图层，当前类型为 ${layer.type}`
		}
		if (layer.type === targetType) {
			return `错误：图层"${layer.name}"已经是 ${targetType} 类型`
		}

		const config = JSON.parse(layer.config)
		const oldStyle = config.style || {}

		if (layer.type === 'scatter' && targetType === 'heatmap') {
			// 散点 → 热力图：保留半径和混合模式，热力图其余使用默认值
			config.style = {
				colorList: defaultHeatmapStyle.colorList,
				colorOffsets: defaultHeatmapStyle.colorOffsets,
				blur: defaultHeatmapStyle.blur,
				radius: oldStyle.radius ?? defaultHeatmapStyle.radius,
				blending: oldStyle.blending ?? 'normalBlending',
			}
		} else if (layer.type === 'heatmap' && targetType === 'scatter') {
			// 热力图 → 散点：保留半径和混合模式，散点其余使用默认值
			config.style = {
				color: defaultScatterStyle.color,
				radius: oldStyle.radius ?? defaultScatterStyle.radius,
				blending: oldStyle.blending ?? 'normalBlending',
			}
		}

		await db()
			.update(layers)
			.set({ type: targetType, config: JSON.stringify(config) })
			.where(eq(layers.id, layerId))

		const typeLabel = targetType === 'scatter' ? '散点图层' : '热力图图层'
		return `已将"${layer.name}"转换为${typeLabel}`
	},
	{
		name: 'convert_layer_type',
		description:
			'将散点图层转换为热力图图层，或将热力图图层转换为散点图层。用户说"把散点图转成热力图"、"切换为热力图"、"改成热力图显示"时调用。转换后保留原有的半径和混合模式设置。',
		schema: z.object({
			projectId: z.string(),
			layerId: z.string(),
			targetType: z.enum(['scatter', 'heatmap']).describe('目标图层类型'),
		}),
	}
)

// ==================== 工具汇总 ====================

export const ALL_TOOLS = [
	getCurrentConfig,
	listLayers,
	setViewportCenter,
	setViewportZoom,
	setColor,
	setRadius,
	setBlendingMode,
	setScatterStyle,
	setScatterDataMapping,
	setPathStyle,
	setHeatmapStyle,
	toggleLayerVisibility,
	reorderLayer,
	removeLayer,
	convertLayerType,
]
