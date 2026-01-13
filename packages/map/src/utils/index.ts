import { Color, Extent } from '@map/types'

export const delay = (duration = 1000) => new Promise((resolve) => setTimeout(resolve, duration))

export const isSameColor = (c1: Color, c2: Color) => {
	return c1.every((c, i) => c2[i])
}

// 通用的数据解析结果接口
export interface ParsedData {
	positions: Float32Array
	extent: Extent
	//  其它扩展字段
	[key: string]: any
}

// 通用的位置和 Extent 解析函数
export function parsePositionsAndExtent(
	data: (number | string)[][],
	lonField: number,
	latField: number,
	lonlat2World: (lon: number, lat: number) => { x: number; y: number }
): { positions: Float32Array; extent: Extent } {
	const len = data.length
	const positions = new Float32Array(len * 2)

	let minLon = Infinity
	let maxLon = -Infinity
	let minLat = Infinity
	let maxLat = -Infinity

	for (let i = 0; i < len; ++i) {
		const row = data[i]
		const lon = Number(row[lonField])
		const lat = Number(row[latField])

		// 更新 extent
		if (lon < minLon) minLon = lon
		if (lon > maxLon) maxLon = lon
		if (lat < minLat) minLat = lat
		if (lat > maxLat) maxLat = lat

		const { x, y } = lonlat2World(lon, lat)
		positions[i * 2 + 0] = x
		positions[i * 2 + 1] = y
	}

	const extent = { w: minLon, e: maxLon, s: minLat, n: maxLat }
	return { positions, extent }
}
