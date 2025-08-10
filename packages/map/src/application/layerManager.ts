import { IBaseLayerProps, IDataLayer } from './dataLayers/layer'
import GMap from '.'
import { Scene } from '@gmap/renderer'
import ScatterLayer, { IProps as ScatterLayerProps } from './dataLayers/scatterLayer'

/** 支持的图层类型 */
export type LayerType = 'scatter'

/** 图层类型与对应类的映射 */
export type LayerClass = {
	scatter: ScatterLayer
}

/** 图层类型与对应属性的映射 */
export type LayerProps = {
	scatter: ScatterLayerProps
}

/** 图层类构造函数映射表，用于根据类型动态创建图层实例 */
const layerClassMap: {
	[T in LayerType]: new (props: IBaseLayerProps & LayerProps[T]) => LayerClass[T]
} = {
	scatter: ScatterLayer,
}

class LayerManager {
	private _layers: Record<string, IDataLayer> = {}
	private _gmap: GMap
	private _scene = new Scene()

	constructor(gmap: GMap) {
		this._gmap = gmap
	}

	get scene() {
		return this._scene
	}

	get gmap() {
		return this._gmap
	}

	getLayer(lid: string) {
		return this._layers[lid] || null
	}

	getAllLayers() {
		return Object.values(this._layers)
	}

	createLayer<T extends LayerType>(
		layerId: string,
		layerType: T,
		layerProps: LayerProps[T]
	): LayerClass[T] {
		const LayerClass = layerClassMap[layerType]
		if (!LayerClass) throw new Error(`Layer type ${layerType} not supported`)
		if (this._layers[layerId]) throw new Error(`Layer id ${layerId} already exists`)
		let level = 0
		for (let l of this.getAllLayers()) {
			if (level === l.getLevel()) level++
		}
		const layer = new LayerClass({
			id: layerId,
			scene: this._scene,
			map: this._gmap,
			level,
			...layerProps,
		})
		this._layers[layerId] = layer
		return layer
	}

	removeLayer(layerId: string) {
		const layer = this.getLayer(layerId)
		if (!layer) throw new Error(`Layer id ${layerId} not exists`)
		layer.dispose()
		delete this._layers[layerId]
	}

	updateCurrentTime() {
		const time = this.gmap.getCurrentTime()
		for (let layerId in this._layers) {
			const layer = this._layers[layerId]
			layer.onTimeUpdate(time)
		}
	}

	dispose() {
		//@ts-ignore
		this._gmap = undefined
		for (let lid in this._layers) {
			this._layers[lid].dispose()
		}
		this._layers = {}
	}

	private getLayersSortedByLevel() {
		return Object.values(this._layers).sort((a, b) => a.getLevel() - b.getLevel())
	}
}

export default LayerManager
