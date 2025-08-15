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

class TileMap {
	private olMap: OlMap
	private tileLayer: TileLayer
	constructor(props: IProps) {
		const { container, tileLayer, center } = props
		const _center = center ? fromLonLat([center.lon, center.lat]) : fromLonLat([120, 30])
		this.olMap = new OlMap({
			target: container,
			layers: [tileLayer],
			view: new View({
				center: _center,
				zoom: 7,
				minZoom: 1,
				maxZoom: 20,
			}),
			interactions: [],
		})
		this.tileLayer = tileLayer
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

	//获取单位度/像素的分辨率
	public getResolutionInDegree() {
		const resolutionInMeter = this.getResolution()
		if (!resolutionInMeter) return null
		const center = this.getCenter()
		if (!center) return null
		const latitude = center[1]
		const metersPerDegree = METERS_PER_DEGREE_AT_EQUATOR * Math.cos((latitude * Math.PI) / 180)
		return resolutionInMeter / metersPerDegree
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

	public calcZoomFromExtent(extent: Extent, width: number, height: number) {
		const resolution = this.getView().getResolutionForExtent(
			[extent.w, extent.s, extent.e, extent.n],
			[width, height]
		)

		const zoom = this.getView().getZoomForResolution(resolution)
		return zoom
	}
}

export default TileMap
