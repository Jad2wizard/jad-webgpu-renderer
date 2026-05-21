import { ref } from 'vue'
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
		await createGMap(container, config, tileLayer, projectId)

		initialized.value = true

		// 3. 注册重建 handler：切换图层或应用映射后调用
		store.registerRecreateHandler(async () => {
			const cfg = store.config
			if (!cfg) return

			// 保存当前视口状态
			const oldGmap = store.gmapInstance as any
			let savedCenter: [number, number] | undefined
			let savedZoom: number | undefined
			if (oldGmap) {
				const pos = oldGmap.view.camera.position
				savedCenter = oldGmap.view.world2Lonlat({ x: pos.x, y: pos.y })
				savedZoom = oldGmap.view.getZoom()
			}

			// 停止动画循环：先标记 inactive，等一帧让已入队的 rAF 回调跑完且不再调度新帧，再 dispose
			if (oldGmap) {
				oldGmap.active = false
				await new Promise((resolve) => requestAnimationFrame(resolve))
				oldGmap.dispose?.()
			}
			store.setGMap(null)

			// 清理容器中的 canvas 和 tile div
			container.innerHTML = ''

			// 用最新配置重建瓦片图层和 gmap
			const newTileLayer = createTileLayer(cfg.tile)

			// 恢复视口
			if (savedCenter) {
				cfg.viewport.center = savedCenter
			}
			if (savedZoom !== undefined) {
				cfg.viewport.zoom = savedZoom
			}

			await createGMap(container, cfg, newTileLayer, projectId)
			initialized.value = true
		})
	}

	/**
	 * 创建 GMap 实例并加载所有图层
	 */
	async function createGMap(
		container: HTMLDivElement,
		config: MapConfig,
		tileLayer: any,
		projectId: string
	) {
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

		// 批量创建数据图层
		await createLayersFromConfig(gmap, config, async (datasetId) => {
			const result = await fetchDatasetData(projectId, datasetId)
			return result.data
		})

		// 为 scatter 图层构建空间索引
		for (const lc of config.layers) {
			if (lc.type === 'scatter') {
				const layer = gmap.layerManager.getLayer(lc.id)
				if (layer?.buildIndexTree) layer.buildIndexTree()
			}
		}
	}

	function dispose() {
		store.gmapInstance?.dispose?.()
		store.setGMap(null)
		initialized.value = false
	}

	return { initMap, dispose, initialized }
}
