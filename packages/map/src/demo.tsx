import React, { useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import GMap from './application'
import XYZ from 'ol/source/XYZ'
import TileLayer from 'ol/layer/Tile'

const tile_url_template = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

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

// 生成正弦波形状的散点数据（模拟 renderer/src/demo/index.ts 的逻辑）
// 为了适应地图经纬度，我们需要将坐标缩放到合理的经纬度范围
// 假设中心点为 [116.40, 39.90] (北京)，范围大概在 10度左右
function generateSineWaveScatterData(num: number = 1000) {
	const data = []
	const centerLon = 116.4
	const centerLat = 39.9

	// 原始 renderer demo 是：
	// pos[2 * i] = (700 / num) * i - 350  => x 范围 [-350, 350]
	// pos[2 * i + 1] = Math.sin(((2 * Math.PI) / num) * i) * 100 => y 范围 [-100, 100]

	// 映射到地图经纬度：
	// x: [-350, 350] -> lon: [centerLon - 5, centerLon + 5] (跨度10度)
	// y: [-100, 100] -> lat: [centerLat - 1.5, centerLat + 1.5] (跨度3度)

	for (let i = 0; i < num; ++i) {
		const xRatio = i / num // 0 ~ 1
		const x = (xRatio - 0.5) * 10 // -5 ~ 5

		const sineVal = Math.sin(((2 * Math.PI) / num) * i)
		const y = sineVal * 1.5 // -1.5 ~ 1.5

		const lon = centerLon + x
		const lat = centerLat + y

		// 模拟颜色和大小数据
		// renderer demo color: r=1, g=(num-i)/num, b=0, a=0.3
		// renderer demo size: abs(sin(...)) * 10 + 10

		const r = 1
		const g = (num - i) / num
		const b = 0
		const a = 0.3

		const radius = Math.abs(sineVal) * 10 + 10

		// 数据结构: [lon, lat, r, g, b, a, radius, label]
		data.push([lon, lat, r, g, b, a, radius, `点${i}`])
	}
	return data
}

const Demo = () => {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const gmapRef = useRef<GMap | null>(null)

	useEffect(() => {
		if (containerRef.current) {
			gmapRef.current = new GMap({
				container: containerRef.current,
				tileLayer: createTileLayer(tile_url_template),
				autoFit: true,
			})

			// 初始视角定位到北京附近
			gmapRef.current.getView().setCenter([116.4, 39.9])
			gmapRef.current.getView().setZoom(8)

			// 添加散点图层
			const scatterLayer = gmapRef.current.addLayer('scatter-points', 'scatter', {
				fields: {
					lon: 0,
					lat: 1,
					labelFields: {
						field: 7,
						title: ['点名称'],
					},
				},
				// 自定义颜色读取逻辑
				getColor: (row) => {
					// row[2]~row[5] 是 r, g, b, a
					return [Number(row[2]), Number(row[3]), Number(row[4]), Number(row[5])]
				},
				// 自定义半径读取逻辑
				getRadius: (row) => {
					return Number(row[6])
				},
				style: {
					// 默认样式作为兜底，会被 getColor/getRadius 覆盖
					color: [0.2, 0.6, 1.0, 0.8],
					radius: 6,
					highlight: {
						color: [1.0, 0.3, 0.3, 1.0],
						radius: 12,
					},
				},
			})

			// 更新散点数据
			const scatterData = generateSineWaveScatterData(100)
			scatterLayer.updateData(scatterData)
		}
	}, [])

	return (
		<div
			key="1"
			ref={containerRef}
			style={{ width: '100vw', height: '100vh', position: 'relative' }}
		></div>
	)
}

const container = document.getElementById('root')
if (container) {
	const root = createRoot(container)
	root.render(<Demo />)
}
