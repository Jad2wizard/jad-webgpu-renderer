import OlMap from 'ol/Map'
import View from 'ol/View'
import { fromLonLat, transform } from 'ol/proj'
import OLTileLayer from 'ol/layer/Tile'
import { Extent } from '@map/types'
import WMTS from 'ol/source/WMTS'
import XYZ from 'ol/source/XYZ'
import OSM from 'ol/source/OSM'

// 地球赤道上每度经度对应的米数（地球赤道周长 ÷ 360度）
const METERS_PER_DEGREE_AT_EQUATOR = 111320

export type TileLayer = OLTileLayer<WMTS> | OLTileLayer<XYZ> | OLTileLayer<OSM>

type IProps = {
	container: HTMLElement
	tileLayer: TileLayer
	center?: { lon: number; lat: number }
}

const defaultZoom = 7

class TileMap {
	private olMap: OlMap
	private container: HTMLElement
	constructor(props: IProps) {
		const { container, tileLayer, center } = props
		this.container = container
		const _center = center ? fromLonLat([center.lon, center.lat]) : fromLonLat([120, 30])
		this.olMap = new OlMap({
			target: container,
			layers: [tileLayer],
			view: new View({
				center: _center,
				zoom: defaultZoom,
				minZoom: 1,
				maxZoom: 20,
			}),
			interactions: [],
			controls: [], // 禁用所有默认控件（包括缩放控件）
		})
		//@ts-ignore
		window.from = fromLonLat
	}

	public getView() {
		return this.olMap.getView()
	}

	// 获取地图中心的经纬度坐标
	public getCenter() {
		const centerInMeter = this.getView().getCenter()
		if (!centerInMeter) {
			return null
		}
		const center = transform(centerInMeter, 'EPSG:3857', 'EPSG:4326')
		return center
	}

	//获取单位米/像素的分辨率
	public getResolution() {
		return this.getView().getResolution()
	}

	public updateView(params: { center?: { lon: number; lat: number }; zoom?: number }) {
		if (params.center) {
			const center = fromLonLat([params.center.lon, params.center.lat])
			this.getView().setCenter(center)
		}
		if (params.zoom) {
			this.getView().setZoom(params.zoom)
		}
	}

	// 处理容器大小变化
	public resize() {
		// 更新容器尺寸
		if (this.container && this.container.parentElement) {
			const parentWidth = this.container.parentElement.offsetWidth
			const parentHeight = this.container.parentElement.offsetHeight
			this.container.style.width = parentWidth + 'px'
			this.container.style.height = parentHeight + 'px'
		}

		// 通知 OpenLayers 地图更新尺寸
		this.olMap.updateSize()
	}
}

export default TileMap
