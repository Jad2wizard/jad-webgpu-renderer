import type {
	MapConfig,
	ScatterLayerConfig,
	ScatterStyleConfig,
	PathLayerConfig,
	HeatmapLayerConfig,
	Color,
} from '@shared/types'

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

function addScatterLayer(gmap: GMap, config: ScatterLayerConfig, data: (number | string)[][]) {
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
			highlighting: style.highlight,
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
