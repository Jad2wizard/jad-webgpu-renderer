import EventEmitter from 'eventemitter3'
import TileMap, { TileLayer } from './tile'
import Renderer from './renderer'
import View from './view'
import Interacts from './interacts'
import { Extent } from '@map/types'
import LayerManager, { LayerType, LayerProps } from '@map/application/layerManager'
import '@map/application/dataLayers/scatterLayer'

type IProps = {
	container: HTMLDivElement
	tileLayer: TileLayer
	center?: { lon: number; lat: number }
	extent?: Extent
}

const defaultExtent: Extent = { w: 73, s: 18, e: 135, n: 54 }

class GMap extends EventEmitter {
	private view: View
	private tileMap: TileMap
	private renderer: Renderer
	private currentTime = 0
	private interacts: Interacts
	private _layerManager = new LayerManager(this)
	private container: HTMLDivElement
	private extent: Extent
	private active = true
	private resizeObserver?: ResizeObserver

	constructor(props: IProps) {
		super()
		this.container = props.container
		this.extent = props.extent || { ...defaultExtent }
		this.interacts = new Interacts({ map: this })
		this.renderer = new Renderer({ container: this.container, antialias: true })
		this.tileMap = this.initTileMap({ ...props, extent: this.extent })
		this.view = this.initView({ ...props, extent: this.extent }, this.renderer.canvas)

		// 异步初始化渲染器
		this.initRenderer().then(() => {
			this.animate()
		})

		// 监听容器大小变化
		this.initResizeObserver()

		//@ts-ignore
		window.map = this
	}

	getView() {
		return this.view
	}

	getRenderer() {
		return this.renderer
	}

	getCurrentTime() {
		return this.currentTime
	}

	setCurentTime(time: number) {
		this.currentTime = time
	}

	getContainer() {
		return this.container
	}

	addLayer<T extends LayerType>(layerId: string, layerType: T, layerProps: LayerProps[T]) {
		return this._layerManager.createLayer<T>(layerId, layerType, layerProps)
	}

	removeLayer(layerId: string) {
		this._layerManager.removeLayer(layerId)
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
			tileMap: this.tileMap,
			width: this.container.offsetWidth,
			height: this.container.offsetHeight,
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
				if (this.tileMap) {
					this.tileMap.resize()
				}
			} catch (error) {
				// 如果渲染器还没有完全初始化，忽略resize事件
				console.warn('Renderer not fully initialized, skipping resize')
			}
		}
	}

	private animate = () => {
		if (this.active) requestAnimationFrame(this.animate)
		this.view.animate()
		// 渲染散点图层
		this.renderer.render(this._layerManager.scene, this.view.camera)
	}

	dispose() {
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
