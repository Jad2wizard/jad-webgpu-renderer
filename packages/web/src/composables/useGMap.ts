import { ref, shallowRef } from 'vue'
import { useMapStore } from '@/stores/map'
import type { MapConfig } from '@shared/types'
import { createTileLayer } from '@/utils/tileFactory'
import { createLayersFromConfig } from '@/utils/applyConfig'
import { fetchDatasetData } from '@/utils/api'

// 动态导入 GMap（避免 Node.js 环境报错，仅在浏览器使用）
let GMapClass: any = null

export function useGMap() {
	const store = useMapStore()
	const initialized = ref(false)

	/**
	 * 初始化 WebGPU 地图实例
	 */
	async function initMap(container: HTMLDivElement, config: MapConfig, projectId: string) {
		if (initialized.value) return

		// 动态导入 map 包
		if (!GMapClass) {
			const mod = await import('@webgpu-gmap/map')
			GMapClass = mod.default
		}

		// 1. 创建瓦片图层
		const tileLayer = createTileLayer(config.tile)

		// 2. 创建 GMap 实例
		const gmap = new GMapClass({
			container,
			tileLayer,
			center: {
				lon: config.viewport.center[0],
				lat: config.viewport.center[1],
			},
			extent: config.viewport.extent,
			autoFit: config.viewport.autoFit,
			interaction: config.interaction,
		})

		gmap.view.setZoom(config.viewport.zoom)
		store.setGMap(gmap)

		// 3. 批量创建数据图层
		await createLayersFromConfig(gmap, config, async (datasetId) => {
			const result = await fetchDatasetData(projectId, datasetId)
			return result.data
		})

		// 4. 为 scatter 图层构建空间索引
		for (const lc of config.layers) {
			if (lc.type === 'scatter') {
				const layer = gmap.layerManager.getLayer(lc.id)
				if (layer?.buildIndexTree) layer.buildIndexTree()
			}
		}

		initialized.value = true
	}

	function dispose() {
		store.gmapInstance?.dispose?.()
		store.setGMap(null)
		initialized.value = false
	}

	return { initMap, dispose, initialized }
}
