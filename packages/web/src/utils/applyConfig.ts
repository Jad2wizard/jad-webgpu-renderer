import type {
	MapConfig,
	ScatterLayerConfig,
	ScatterStyleConfig,
	PathLayerConfig,
	HeatmapLayerConfig,
	Color,
} from '@shared/types'
import { defaultHeatmapStyle, defaultScatterStyle } from '@shared/types'

type GMap = any

/**
 * 为每个图层创建对应的 GMap 图层并传入数据
 */
export async function createLayersFromConfig(
	gmap: GMap,
	config: MapConfig,
	getData: (datasetId: string) => Promise<(number | string)[][]>
) {
	for (const lc of config.layers) {
		const data = await getData(lc.datasetId)
		if (!data.length) continue

		let layer: any
		switch (lc.type) {
			case 'scatter':
				layer = addScatterLayer(gmap, lc, data)
				break
			case 'path':
				layer = addPathLayer(gmap, lc, data)
				break
			case 'heatmap':
				layer = addHeatmapLayer(gmap, lc, data)
				break
		}

		// 关键：调用 updateData 将顶点数据写入 GPU 缓冲区
		if (layer) {
			await layer.updateData(data)
			if (lc.type === 'scatter' && layer.buildIndexTree) {
				layer.buildIndexTree()
			}
		}
	}
}

/**
 * 重建散点图层（用于更新 colorMapping / radiusMapping 后重新生成 per-point 数据）
 *
 * 先删除旧图层并等待 GPU 帧完成释放资源，再创建新图层，避免 WebGPU 资源冲突。
 */
export async function rebuildScatterLayer(
	gmap: GMap,
	config: ScatterLayerConfig,
	data: (number | string)[][]
) {
	// 1. 从 Scene 中移除旧图层并释放 WebGPU 资源
	gmap.removeLayer(config.id)

	// 2. 等待帧完成，确保 GPU 释放旧管线资源
	await new Promise((resolve) => requestAnimationFrame(resolve))
	await new Promise((resolve) => requestAnimationFrame(resolve))

	// 3. 重新创建图层
	const layer = addScatterLayer(gmap, config, data)
	await layer.updateData(data)
	if (layer.buildIndexTree) {
		layer.buildIndexTree()
	}
	return layer
}

export function addScatterLayer(
	gmap: GMap,
	config: ScatterLayerConfig,
	data: (number | string)[][]
) {
	const { fields, style } = config

	return gmap.addLayer(config.id, 'scatter', {
		fields: {
			lon: fields.lonField,
			lat: fields.latField,
			startTime: fields.timeField,
			labelFields: fields.labelField,
		},
		style: {
			color: style.color,
			radius: style.radius,
			blending: style.blending,
		},
		getColor: buildColorCallback(style),
		getRadius: buildRadiusCallback(style),
		total: data.length,
	})
}

function addPathLayer(gmap: GMap, config: PathLayerConfig, data: (number | string)[][]) {
	const { fields, style } = config

	return gmap.addLayer(config.id, 'path', {
		fields: {
			pathId: fields.pathIdField,
			lon: fields.lonField,
			lat: fields.latField,
			startTime: fields.timeField,
		},
		style: {
			color: style.color,
			lineWidth: style.lineWidth,
			unplayedColor: style.unplayedColor,
			unplayedLineWidth: style.unplayedLineWidth,
			trailDuration: style.trailDuration,
			headPointVisible: style.headPointVisible,
			headPointColor: style.headPointColor,
			headPointSize: style.headPointSize,
			drawLine: style.drawLine,
			blending: style.blending,
		},
	})
}

/**
 * 将散点图层转换为热力图图层（复用同一份数据）
 */
export async function convertScatterToHeatmap(
	gmap: GMap,
	scatterConfig: ScatterLayerConfig,
	data: (number | string)[][]
) {
	gmap.removeLayer(scatterConfig.id)

	// 等待 GPU 帧完成释放资源（热力图有 3-pass 管线，多等一帧）
	await new Promise((resolve) => requestAnimationFrame(resolve))
	await new Promise((resolve) => requestAnimationFrame(resolve))
	await new Promise((resolve) => requestAnimationFrame(resolve))
	await new Promise((resolve) => requestAnimationFrame(resolve))
	await new Promise((resolve) => requestAnimationFrame(resolve))

	const heatmapConfig: HeatmapLayerConfig = {
		id: scatterConfig.id,
		name: scatterConfig.name,
		type: 'heatmap',
		visible: scatterConfig.visible,
		level: scatterConfig.level,
		datasetId: scatterConfig.datasetId,
		fields: {
			lonField: scatterConfig.fields.lonField,
			latField: scatterConfig.fields.latField,
			timeField: scatterConfig.fields.timeField,
		},
		style: {
			colorList: defaultHeatmapStyle.colorList,
			colorOffsets: defaultHeatmapStyle.colorOffsets,
			blur: defaultHeatmapStyle.blur,
			radius: scatterConfig.style.radius,
			blending: scatterConfig.style.blending,
		},
	}

	const layer = addHeatmapLayer(gmap, heatmapConfig, data)
	await layer.updateData(data)
	return { layer, config: heatmapConfig }
}

/**
 * 将热力图图层转换为散点图层（复用同一份数据）
 */
export async function convertHeatmapToScatter(
	gmap: GMap,
	heatmapConfig: HeatmapLayerConfig,
	data: (number | string)[][]
) {
	gmap.removeLayer(heatmapConfig.id)

	// 等待 GPU 帧完成释放资源（热力图有 3-pass 管线，多等一帧）
	await new Promise((resolve) => requestAnimationFrame(resolve))
	await new Promise((resolve) => requestAnimationFrame(resolve))
	await new Promise((resolve) => requestAnimationFrame(resolve))

	const scatterConfig: ScatterLayerConfig = {
		id: heatmapConfig.id,
		name: heatmapConfig.name,
		type: 'scatter',
		visible: heatmapConfig.visible,
		level: heatmapConfig.level,
		datasetId: heatmapConfig.datasetId,
		fields: {
			lonField: heatmapConfig.fields.lonField,
			latField: heatmapConfig.fields.latField,
			timeField: heatmapConfig.fields.timeField,
		},
		style: {
			color: defaultScatterStyle.color,
			radius: heatmapConfig.style.radius,
			blending: heatmapConfig.style.blending,
		},
	}

	const layer = addScatterLayer(gmap, scatterConfig, data)
	await layer.updateData(data)
	if (layer.buildIndexTree) {
		layer.buildIndexTree()
	}
	return { layer, config: scatterConfig }
}

function addHeatmapLayer(gmap: GMap, config: HeatmapLayerConfig, data: (number | string)[][]) {
	const { fields, style } = config

	return gmap.addLayer(config.id, 'heatmap', {
		fields: {
			lon: fields.lonField,
			lat: fields.latField,
			startTime: fields.timeField,
		},
		style: {
			colorList: style.colorList,
			colorOffsets: style.colorOffsets,
			blur: style.blur,
			radius: style.radius,
			blending: style.blending,
		},
		total: data.length,
	})
}

function buildColorCallback(style: ScatterStyleConfig) {
	if (!style.colorMapping) return undefined

	const { r, g, b, a, range } = style.colorMapping
	return (row: any[]) => {
		const norm = (v: number) => {
			if (!range) return Math.max(0, Math.min(1, Number(v)))
			return Math.max(0, Math.min(1, (Number(v) - range[0]) / (range[1] - range[0])))
		}
		return [
			norm(row[r] as number),
			norm(row[g] as number),
			norm(row[b] as number),
			norm(row[a] as number),
		] as Color
	}
}

function buildRadiusCallback(style: ScatterStyleConfig) {
	if (!style.radiusMapping) return undefined

	const { field, range } = style.radiusMapping
	return (row: any[]) => {
		const val = Number(row[field])
		if (!range) return Math.max(1, Math.min(255, val))
		return Math.max(range[0], Math.min(range[1], val))
	}
}
