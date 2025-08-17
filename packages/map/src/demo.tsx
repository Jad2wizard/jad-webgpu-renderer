import React, { useRef, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import GMap from './application'
import XYZ from 'ol/source/XYZ'
import TileLayer from 'ol/layer/Tile'
import { Points, Scene } from '@webgpu-gmap/renderer'

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

// 生成随机散点数据
function generateRandomScatterData() {
	const data = []
	for (let i = 0; i < 100; i++) {
		// 经度范围：100-125，纬度范围：25-35
		const lon = 100 + Math.random() * 25
		const lat = 25 + Math.random() * 10
		data.push([lon, lat, `点${i + 1}`])
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
			})

			// 添加散点图层
			const scatterLayer = gmapRef.current.addLayer('scatter-points', 'scatter', {
				fields: {
					lon: 0, // 经度在数据数组的第0个位置
					lat: 1, // 纬度在数据数组的第1个位置
					labelFields: {
						field: 2, // 标签在数据数组的第2个位置
						title: ['点名称'], // 标签字段的标题
					},
				},
				style: {
					color: [0.2, 0.6, 1.0, 0.8], // 蓝色散点
					radius: 6,
					highlight: {
						color: [1.0, 0.3, 0.3, 1.0], // 红色高亮
						radius: 12,
					},
				},
			})

			// 更新散点数据
			const scatterData = generateRandomScatterData()
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
