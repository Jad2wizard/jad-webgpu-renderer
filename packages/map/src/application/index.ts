import { Vector2 } from 'three'
import EventEmitter from 'eventemitter3'
import TileMap, { TileLayer } from './tile'
import Renderer from './renderer'
import View from './view'
import Interacts, { InteractionConfig } from './interaction/interacts'
import { Extent } from '@map/types'
import LayerManager, { LayerType, LayerProps } from '@map/application/layerManager'
import '@map/application/dataLayers/scatterLayer'
import PerformanceWidget from './widgets/PerformanceWidget'

type IProps = {
	container: HTMLDivElement
	tileLayer: TileLayer
	center?: { lon: number; lat: number }
	extent?: Extent
	autoFit?: boolean
	interaction?: InteractionConfig
}

const defaultExtent: Extent = { w: 73, s: 18, e: 135, n: 54 }

class GMap extends EventEmitter {
	private _view: View
	private _tileMap: TileMap
	private _renderer: Renderer
	private _currentTime = 0
	private _interacts: Interacts
	private _layerManager = new LayerManager(this)
	private _container: HTMLDivElement
	private _performanceWidget: PerformanceWidget
	private extent: Extent
	private active = true
	private resizeObserver?: ResizeObserver
	private autoFit = false
	private autoFitTimer: NodeJS.Timeout | null = null

	constructor(props: IProps) {
		super()
		this._container = props.container
		if (!this._container.style.position) {
			this._container.style.position = 'relative'
		}
		this._interacts = new Interacts({ map: this, config: props.interaction })
		this._renderer = new Renderer({ container: this._container, antialias: true })
		this._tileMap = this.initTileMap({ ...props, extent: this.extent })
		this._view = this.initView({ ...props, extent: this.extent }, this._renderer.canvas)
		this._performanceWidget = new PerformanceWidget(this)

		this.extent = props.extent || { ...defaultExtent }
		this.autoFit = !!props.autoFit
		// 异步初始化渲染器
		this.initRenderer().then(() => {
			this.animate()
		})

		// 监听容器大小变化
		this.initResizeObserver()

		//@ts-ignore
		window.map = this
	}

	get view() {
		return this._view
	}

	get renderer() {
		return this._renderer
	}

	get currentTime() {
		return this._currentTime
	}

	set currentTime(time: number) {
		this._currentTime = time
	}

	get container() {
		return this._container
	}

	get tileMap() {
		return this._tileMap
	}

	get layerManager() {
		return this._layerManager
	}

	get interacts() {
		return this._interacts
	}

	addLayer<T extends LayerType>(layerId: string, layerType: T, layerProps: LayerProps[T]) {
		return this._layerManager.addLayer<T>(layerId, layerType, layerProps)
	}

	removeLayer(layerId: string) {
		this._layerManager.removeLayer(layerId)
	}

	checkAutoFit() {
		if (!this.autoFit) return
		if (this.autoFitTimer) {
			clearTimeout(this.autoFitTimer)
		}
		this.autoFitTimer = setTimeout(() => {
			this.fitView()
			this.autoFitTimer = null
		}, 100)
	}

	fitView() {
		const layers = this._layerManager.getAllLayers()
		if (layers.length === 0) return

		let combinedExtent: Extent | null = null

		for (const layer of layers) {
			if (!layer.getVisible()) continue
			const extent = layer.getExtent()
			if (!extent) continue

			if (!combinedExtent) {
				combinedExtent = { ...extent }
			} else {
				combinedExtent.w = Math.min(combinedExtent.w, extent.w)
				combinedExtent.e = Math.max(combinedExtent.e, extent.e)
				combinedExtent.s = Math.min(combinedExtent.s, extent.s)
				combinedExtent.n = Math.max(combinedExtent.n, extent.n)
			}
		}

		if (combinedExtent) {
			this.view.fitBounds(combinedExtent)
		}
	}

	handleInteractEvent(
		type: string,
		params: { x: number; y: number; left: number; top: number; data?: any }
	) {
		const lnglat = this.view.world2Lonlat(new Vector2(params.x, params.y))
		const eventData = {
			...params,
			lng: lnglat[0],
			lat: lnglat[1],
		}
		this.emit(type, eventData)
	}

	private initTileMap(props: IProps) {
		const tileContainer = document.createElement('div')
		tileContainer.style.width = this.container.offsetWidth + 'px'
		tileContainer.style.height = this.container.offsetHeight + 'px'
		this.container.appendChild(tileContainer)
		return new TileMap({
			container: tileContainer,
			tileLayer: props.tileLayer,
			center: props.center,
		})
	}

	private initView(props: IProps, canvas: HTMLCanvasElement) {
		const viewInstance = new View({
			tileMap: this._tileMap,
			width: this._container.offsetWidth,
			height: this._container.offsetHeight,
			extent: this.extent,
			center: props.center,
			controlCanvas: canvas,
		})
		return viewInstance
	}

	private async initRenderer() {
		await this.renderer.init()
	}

	private initResizeObserver() {
		this.resizeObserver = new ResizeObserver(() => {
			this.handleResize()
		})
		this.resizeObserver.observe(this.container)
	}

	private handleResize() {
		// 确保渲染器已经初始化完成
		if (this.renderer && this.renderer.canvas) {
			try {
				this.renderer.resize()
				// 更新View的尺寸和相机投影矩阵
				if (this.view) {
					const canvas = this.renderer.canvas
					this.view.resize(canvas.width, canvas.height)
				}
				// 更新地图瓦片容器尺寸
				if (this._tileMap) {
					this._tileMap.resize()
				}
			} catch (e) {
				// 如果渲染器还没有完全初始化，忽略resize事件
				console.warn('Renderer not fully initialized, skipping resize')
			}
		}
	}

	private animate = () => {
		if (this.active) requestAnimationFrame(this.animate)
		this.view.animate()
		this._layerManager.updateCurrentTime()
		// 渲染散点图层
		this.renderer.render(this._layerManager.scene, this.view.camera)
	}

	dispose() {
		this.active = false
		this._performanceWidget.dispose()
		this._interacts.dispose()
		this._layerManager.dispose()
		this.view.dispose()
		this.removeAllListeners()
		// 清理ResizeObserver
		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
			this.resizeObserver = undefined
		}
	}
}

export default GMap
