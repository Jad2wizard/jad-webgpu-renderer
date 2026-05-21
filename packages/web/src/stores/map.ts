import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { MapConfig, LayerConfig, ViewportConfig } from '@shared/types'
import { defaultHeatmapStyle, defaultScatterStyle } from '@shared/types'

// GMap 类型从 map 包导出，这里做前向声明以解耦
type GMapInstance = InstanceType<(typeof import('@webgpu-gmap/map'))['default']> | null

export const useMapStore = defineStore('map', () => {
	// ---- 地图实例 ----
	const gmapInstance = shallowRef<any>(null)

	function setGMap(g: any) {
		gmapInstance.value = g
	}

	// ---- 配置 ----
	const config = ref<MapConfig | null>(null)
	const selectedLayerId = ref<string | null>(null)
	const isUploading = ref(false)
	const chatPanelOpen = ref(false)

	// ---- 计算属性 ----
	const layers = computed(() => config.value?.layers ?? [])
	const selectedLayer = computed(
		() => layers.value.find((l) => l.id === selectedLayerId.value) ?? null
	)

	function selectLayer(id: string | null) {
		selectedLayerId.value = id
	}

	// ---- 视口操作 ----
	function updateViewport(vp: Partial<ViewportConfig>) {
		if (!config.value) return
		Object.assign(config.value.viewport, vp)

		const g = gmapInstance.value as any
		if (!g) return
		if (vp.center) g.view.setCenter([vp.center[0], vp.center[1]])
		if (vp.zoom !== undefined) g.view.setZoom(vp.zoom)
	}

	// ---- 图层样式更新（手动编辑，非 Agent 触发） ----
	function updateLayerStyle(layerId: string, style: Record<string, unknown>) {
		const layer = layers.value.find((l) => l.id === layerId)
		if (!layer) return
		Object.assign(layer.style, style)

		const g = gmapInstance.value as any
		g?.layerManager.getLayer(layerId)?.updateStyle(style)
	}

	// ---- gmap 重建（切换图层类型 / 应用映射后调用） ----
	let _recreateGMapHandler: (() => Promise<void>) | null = null

	function registerRecreateHandler(fn: () => Promise<void>) {
		_recreateGMapHandler = fn
	}

	async function recreateGMap() {
		if (_recreateGMapHandler) {
			await _recreateGMapHandler()
		}
	}

	// ---- 应用映射 → 重建 gmap ----
	async function rebuildScatterLayerFromMapping(_projectId: string, _layerId: string) {
		await recreateGMap()
	}

	// ---- 热力图切换回散点图层 ----
	async function convertLayerToScatter(_projectId: string, layerId: string) {
		const idx = layers.value.findIndex((l) => l.id === layerId)
		if (idx === -1) return
		const layer = layers.value[idx]
		if (layer.type !== 'heatmap') return

		// 更新响应式配置：改类型 + 重置样式
		const updatedLayer: any = {
			...layer,
			type: 'scatter',
			style: { ...defaultScatterStyle, radius: (layer.style as any).radius },
		}
		const newLayers = [...layers.value]
		newLayers[idx] = updatedLayer
		if (config.value) {
			config.value = { ...config.value, layers: newLayers }
		}

		await recreateGMap()
	}

	// ---- 散点图层切换为热力图 ----
	async function convertLayerToHeatmap(_projectId: string, layerId: string) {
		const idx = layers.value.findIndex((l) => l.id === layerId)
		if (idx === -1) return
		const layer = layers.value[idx]
		if (layer.type !== 'scatter') return

		// 更新响应式配置：改类型 + 重置样式
		const updatedLayer: any = {
			...layer,
			type: 'heatmap',
			style: {
				...defaultHeatmapStyle,
				radius: (layer.style as any).radius,
			},
		}
		const newLayers = [...layers.value]
		newLayers[idx] = updatedLayer
		if (config.value) {
			config.value = { ...config.value, layers: newLayers }
		}

		await recreateGMap()
	}

	// ---- Agent 修改后全量刷新配置（收到 config_changed 事件时调用） ----
	function refreshFromConfig(newConfig: MapConfig) {
		const prevConfig = config.value
		config.value = newConfig
		const g = gmapInstance.value as any
		if (!g) return

		// 仅当视口实际变更时才更新相机（避免纯样式修改时重置 zoom）
		const newVp = newConfig.viewport
		const prevVp = prevConfig?.viewport
		const vpChanged =
			!prevVp ||
			prevVp.center[0] !== newVp.center[0] ||
			prevVp.center[1] !== newVp.center[1] ||
			prevVp.zoom !== newVp.zoom

		if (vpChanged) {
			g.view.setCenter([newVp.center[0], newVp.center[1]])
			g.view.setZoom(newVp.zoom)
		}

		// 图层变更
		const newIds = new Set(newConfig.layers.map((l) => l.id))
		for (const oldLayer of prevConfig?.layers ?? []) {
			if (!newIds.has(oldLayer.id)) g.removeLayer(oldLayer.id)
		}
		for (const lc of newConfig.layers) {
			const existing = g.layerManager.getLayer(lc.id)
			if (existing) {
				existing.setVisible(lc.visible)
				existing.setLevel(lc.level)
				if (lc.style) existing.updateStyle(lc.style)
			}
		}
	}

	return {
		gmapInstance,
		setGMap,
		config,
		selectedLayerId,
		isUploading,
		chatPanelOpen,
		layers,
		selectedLayer,
		selectLayer,
		updateViewport,
		updateLayerStyle,
		refreshFromConfig,
		registerRecreateHandler,
		recreateGMap,
		rebuildScatterLayerFromMapping,
		convertLayerToHeatmap,
		convertLayerToScatter,
	}
})
