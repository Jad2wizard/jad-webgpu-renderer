import EventEmitter from 'eventemitter3'
import TileMap, { TileLayer } from './tile'
import Renderer from './renderer'
import View from './view'
import Interacts from './interacts'
import { Extent } from '@/types'
import LayerManager, { LayerType, LayerProps } from '@/application/layerManager'
import '@/application/dataLayers/scatterLayer'

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

	constructor(props: IProps) {
		super()
		this.container = props.container
		this.extent = props.extent || { ...defaultExtent }
		this.interacts = new Interacts({ map: this })
		this.renderer = new Renderer({ container: this.container, antialias: true })
		this.view = this.initView({ ...props, extent: this.extent }, this.renderer.canvas)
		this.tileMap = this.initTileMap({ ...props, extent: this.extent })

		//@ts-ignore
		window.map = this
		this.animate()
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

	private animate = () => {
		if (this.active) requestAnimationFrame(this.animate)
		this.view.animate()
	}

	dispose() {
		this._layerManager.dispose()
		this.view.dispose()
		this.removeAllListeners()
	}
}

export default GMap
