import { XYZ, OSM } from 'ol/source'
import TileLayer from 'ol/layer/Tile'
import type { TileConfig } from '@shared/types'

/**
 * 根据 TileConfig 创建 OpenLayers 瓦片图层
 */
export function createTileLayer(config: TileConfig): TileLayer {
	let source: XYZ | OSM

	switch (config.type) {
		case 'osm':
			source = new OSM()
			break
		case 'xyz':
		default:
			source = new XYZ({
				url: config.urlTemplate || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
				maxZoom: config.maxZoom ?? 18,
				minZoom: config.minZoom ?? 1,
				attributions: config.attribution,
			})
			break
	}

	return new TileLayer({
		source,
		opacity: config.opacity ?? 1,
	})
}
