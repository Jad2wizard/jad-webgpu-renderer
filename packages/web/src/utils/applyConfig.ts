import type { MapConfig, LayerConfig, ScatterLayerConfig, ScatterStyleConfig, PathLayerConfig, HeatmapLayerConfig, Color } from "@shared/types"

type GMap = any

/**
 * 为每个图层创建对应的 GMap 图层（从配置 + 已解析数据）
 *
 * 注意：map 包的 GMap.addLayer 需要 column-index-based fields，
 * 而 config 中存储的是有名字段。这里做转换。
 */
export async function createLayersFromConfig(
  gmap: GMap,
  config: MapConfig,
  getData: (datasetId: string) => Promise<(number | string)[][]>
) {
  for (const lc of config.layers) {
    const data = await getData(lc.datasetId)

    switch (lc.type) {
      case "scatter":
        addScatterLayer(gmap, lc, data)
        break
      case "path":
        addPathLayer(gmap, lc, data)
        break
      case "heatmap":
        addHeatmapLayer(gmap, lc, data)
        break
    }
  }
}

function addScatterLayer(gmap: GMap, config: ScatterLayerConfig, _data: (number | string)[][]) {
  const { fields, style } = config
  const getColor = buildColorCallback(style)
  const getRadius = buildRadiusCallback(style)

  const layer = gmap.addLayer(config.id, "scatter", {
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
    getColor,
    getRadius,
    total: _data.length,
  })

  return layer
}

function addPathLayer(gmap: GMap, config: PathLayerConfig, _data: (number | string)[][]) {
  const { fields, style } = config

  const layer = gmap.addLayer(config.id, "path", {
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

  return layer
}

function addHeatmapLayer(gmap: GMap, config: HeatmapLayerConfig, _data: (number | string)[][]) {
  const { fields, style } = config

  const layer = gmap.addLayer(config.id, "heatmap", {
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
    total: _data.length,
  })

  return layer
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
