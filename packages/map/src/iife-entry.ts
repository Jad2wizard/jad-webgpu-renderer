import GMap from './application/index'
import XYZ from 'ol/source/XYZ'
import TileLayer from 'ol/layer/Tile'

// 创建瓦片图层的辅助函数
function createTileLayer(urlTemplate: string) {
	const source = new XYZ({
		url: urlTemplate,
		maxZoom: 18,
		attributions: '© OpenStreetMap contributors',
	})

	return new TileLayer({
		source,
	})
}

// 生成随机散点数据的辅助函数
function generateRandomScatterData(count: number = 100) {
	const data = []
	for (let i = 0; i < count; i++) {
		// 经度范围：100-125，纬度范围：25-35
		const lon = 100 + Math.random() * 25
		const lat = 25 + Math.random() * 10
		data.push([lon, lat, `点${i + 1}`])
	}
	return data
}

// 创建地图实例的工厂函数
function createMap(container: HTMLElement, options: {
	tileUrl?: string,
	center?: { lon: number, lat: number },
	extent?: { w: number, s: number, e: number, n: number },
	boxSelect?: { enabled?: boolean, key?: 'ctrl' | 'shift' | 'alt' | 'meta' }
} = {}) {
	const tileUrl = options.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
	const tileLayer = createTileLayer(tileUrl)
	
	const gmap = new GMap({
		container,
		tileLayer,
		center: options.center,
		extent: options.extent,
		boxSelect: options.boxSelect,
	})

	return gmap
}

// 创建散点图层的辅助函数
function createScatterLayer(gmap: GMap, layerId: string, data: any[], styleOptions: {
	color?: number[],
	radius?: number,
	highlightColor?: number[],
	highlightRadius?: number
} = {}) {
	const scatterLayer = gmap.addLayer(layerId, 'scatter', {
		fields: {
			lon: 0, // 经度在数据数组的第0个位置
			lat: 1, // 纬度在数据数组的第1个位置
			labelFields: {
				field: 2, // 标签在数据数组的第2个位置
				title: ['点名称'], // 标签字段的标题
			},
		},
		style: {
			color: styleOptions.color || [0.2, 0.6, 1.0, 0.8], // 默认蓝色
			radius: styleOptions.radius || 6,
			highlight: {
				color: styleOptions.highlightColor || [1.0, 0.3, 0.3, 1.0], // 默认红色高亮
				radius: styleOptions.highlightRadius || 12,
			},
		},
	})

	// 更新散点数据
	if (data && data.length > 0) {
		scatterLayer.updateData(data)
	}

	return scatterLayer
}

// 导出到全局命名空间
export {
	GMap,
	createTileLayer,
	generateRandomScatterData,
	createMap,
	createScatterLayer
}

// 如果是浏览器环境，挂载到全局对象
if (typeof window !== 'undefined') {
	(window as any).GMap = {
		GMap,
		createTileLayer,
		generateRandomScatterData,
		createMap,
		createScatterLayer
	}
}
