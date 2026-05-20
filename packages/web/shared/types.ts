// ============================================================
// 前后端共享类型定义
// 前端 Vue 3 组件 / Pinia Store 和 后端 Express / Agent 共用
// ============================================================

// ---- 基础类型 ----

/** RGBA 颜色，每个分量 0-1 */
export type Color = [number, number, number, number]

/** WebGPU 混合模式 */
export type Blending = "normalBlending" | "additiveBlending" | "subtractiveBlending"

/** 图层类型 */
export type LayerType = "scatter" | "path" | "heatmap"

/** 地图边界（经纬度） */
export interface Extent {
  w: number // 西
  s: number // 南
  e: number // 东
  n: number // 北
}

// ---- 视口配置 ----

export interface ViewportConfig {
  center: [number, number] // [lon, lat]
  zoom: number
  extent?: Extent
  autoFit: boolean
  maxLon: number
  minLon: number
  maxLat: number
  minLat: number
}

export const defaultViewport: ViewportConfig = {
  center: [116.4, 39.9],
  zoom: 5,
  maxLon: 135,
  minLon: 73,
  maxLat: 54,
  minLat: 18,
  autoFit: true,
}

// ---- 瓦片配置 ----

export interface TileConfig {
  type: "xyz" | "wmts" | "osm"
  urlTemplate?: string
  maxZoom?: number
  minZoom?: number
  opacity?: number
  attribution?: string
}

export const defaultTile: TileConfig = {
  type: "xyz",
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxZoom: 18,
  minZoom: 1,
  opacity: 1,
  attribution: "© OpenStreetMap contributors",
}

// ---- 散点图层配置 ----

export interface ScatterFieldsConfig {
  lonField: number
  latField: number
  timeField?: number
  labelField?: { field: number; title: string[] }
}

export interface ScatterStyleConfig {
  color: Color
  radius: number
  highlight?: { color: Color; radius: number }
  blending: Blending
  colorMapping?: { r: number; g: number; b: number; a: number; range?: [number, number] }
  radiusMapping?: { field: number; range?: [number, number] }
}

export interface ScatterLayerConfig {
  id: string
  name: string
  type: "scatter"
  visible: boolean
  level: number
  datasetId: string
  fields: ScatterFieldsConfig
  style: ScatterStyleConfig
}

export const defaultScatterStyle: ScatterStyleConfig = {
  color: [0.83, 0.18, 0.16, 1],
  radius: 8,
  highlight: { color: [1, 0.11, 0.08, 1], radius: 15 },
  blending: "normalBlending",
}

// ---- 轨迹图层配置 ----

export interface PathFieldsConfig {
  pathIdField: number
  lonField: number
  latField: number
  timeField?: number
}

export interface PathStyleConfig {
  color: Color
  lineWidth: number
  unplayedColor: Color
  unplayedLineWidth: number
  trailDuration: number
  headPointVisible: boolean
  headPointColor: Color
  headPointSize: number
  drawLine: boolean
  blending: Blending
}

export interface PathLayerConfig {
  id: string
  name: string
  type: "path"
  visible: boolean
  level: number
  datasetId: string
  fields: PathFieldsConfig
  style: PathStyleConfig
}

export const defaultPathStyle: PathStyleConfig = {
  color: [1, 0.3, 0.2, 0.7],
  lineWidth: 5,
  unplayedColor: [0, 0, 0, 0.05],
  unplayedLineWidth: 5,
  trailDuration: 0,
  headPointVisible: false,
  headPointColor: [1, 0.9, 0.3, 1],
  headPointSize: 10,
  drawLine: false,
  blending: "normalBlending",
}

// ---- 热力图图层配置 ----

export interface HeatmapFieldsConfig {
  lonField: number
  latField: number
  timeField?: number
}

export interface HeatmapStyleConfig {
  colorList: [Color, Color, Color, Color, Color]
  colorOffsets: [number, number, number, number, number]
  blur: number
  radius: number
  blending: Blending
}

export interface HeatmapLayerConfig {
  id: string
  name: string
  type: "heatmap"
  visible: boolean
  level: number
  datasetId: string
  fields: HeatmapFieldsConfig
  style: HeatmapStyleConfig
}

export const defaultHeatmapStyle: HeatmapStyleConfig = {
  colorList: [
    [1, 0, 0, 0],
    [0.9, 0.9, 0, 0],
    [0.1, 0.8, 0.2, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 0],
  ],
  colorOffsets: [1, 0.85, 0.45, 0.25, 0],
  blur: 0.8,
  radius: 30,
  blending: "normalBlending",
}

// ---- 联合类型 ----

export type LayerConfig = ScatterLayerConfig | PathLayerConfig | HeatmapLayerConfig

// ---- 交互配置 ----

export interface InteractionConfig {
  boxSelect?: { enabled: boolean; key: "ctrl" | "shift" | "alt" | "meta" }
}

// ---- 顶层配置 ----

export interface MapConfig {
  version: 1
  viewport: ViewportConfig
  tile: TileConfig
  layers: LayerConfig[]
  interaction: InteractionConfig
}

export const defaultInteraction: InteractionConfig = {
  boxSelect: { enabled: true, key: "ctrl" },
}

/** 构建一个带默认值的完整 MapConfig */
export function createDefaultMapConfig(): MapConfig {
  return {
    version: 1,
    viewport: { ...defaultViewport },
    tile: { ...defaultTile },
    layers: [],
    interaction: { ...defaultInteraction },
  }
}

// ---- 数据集相关类型 ----

export interface DatasetMeta {
  id: string
  projectId: string
  name: string
  originalName: string
  fileSize: number
  featureCount: number
  geometryType: string
  extent: Extent | null
  createdAt: string
}

export interface DatasetData {
  data: (number | string)[][]
  extent: Extent | null
  featureCount: number
  geometryType: string
}

// ---- API 请求/响应类型 ----

export interface RegisterRequest {
  email: string
  password: string
  name?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  user: { id: string; email: string; name: string }
  token: string
}

export interface ProjectListItem {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectDetail {
  id: string
  ownerId: string
  name: string
  description: string | null
  viewport: ViewportConfig
  tileConfig: TileConfig
  layers: LayerConfig[]
  createdAt: string
  updatedAt: string
}

export interface ChatSessionItem {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

// ---- SSE 事件类型 ----

export type ChatSSEEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: string }
  | { type: "config_changed" }
  | { type: "done"; content: string; toolCalls?: unknown[] }
  | { type: "error"; message: string }
