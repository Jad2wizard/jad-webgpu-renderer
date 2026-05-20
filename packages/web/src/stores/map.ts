import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import type { MapConfig, LayerConfig, ViewportConfig } from '@shared/types'

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

	// ---- Agent 修改后全量刷新配置（收到 config_changed 事件时调用） ----
	function refreshFromConfig(newConfig: MapConfig) {
		config.value = newConfig
		const g = gmapInstance.value as any
		if (!g) return

		// 视口
		const vp = newConfig.viewport
		g.view.setCenter([vp.center[0], vp.center[1]])
		g.view.setZoom(vp.zoom)

		// 图层变更
		const newIds = new Set(newConfig.layers.map((l) => l.id))
		for (const oldLayer of config.value?.layers ?? []) {
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
		ttchatPanelOpen,
		layers,
		selectedLayer,
		selectLayer,
		updateViewport,
		updateLayerStyle,
		refreshFromConfig,
	}
})
