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

// 模拟 renderer/src/Demo/index.ts 的数据生成逻辑
function generateDemoData(num: number = 1000) {
	const totalTime = 20000 // 20s in ms

	// Coordinate mapping
	const centerLon = 116.4
	const centerLat = 39.9
	const scale = 0.001 // Map renderer units to degrees

	const pos = new Float32Array(num * 2)
	const timestamps = new Float32Array(num)

	// Base data generation
	for (let i = 0; i < num; ++i) {
		const x = (700 / num) * i - 350
		const y = Math.sin(((2 * Math.PI) / num) * i) * 100

		pos[2 * i] = x
		pos[2 * i + 1] = y
		timestamps[i] = (totalTime / num) * i
	}

	// 1. Heatmap Data
	// heatPoints = pos.map((p, i) => (i % 2 === 1 ? p * -1 : p * 0.9))
	const heatmapData = []
	for (let i = 0; i < num; ++i) {
		let x = pos[2 * i]
		let y = pos[2 * i + 1]

		// Logic from renderer demo:
		// pos is flattened array [x0, y0, x1, y1...]
		// The map in renderer demo operates on each number.
		// i%2===1 checks if it is y coordinate (odd index).
		// If y (odd): p * -1. If x (even): p * 0.9.
		x = x * 0.9
		y = y * -1

		const lon = centerLon + x * scale
		const lat = centerLat + y * scale
		const time = timestamps[i]
		heatmapData.push([lon, lat, time])
	}

	// 2. Paths Data
	const pathsData = []

	// Path 1
	// position: pos
	for (let i = 0; i < num; ++i) {
		const x = pos[2 * i]
		const y = pos[2 * i + 1]
		const lon = centerLon + x * scale
		const lat = centerLat + y * scale
		const time = timestamps[i]
		pathsData.push([1, lon, lat, time])
	}

	// Path 2
	// position: pos.map((p, i) => (i % 2 === 1 ? p * -1.1 : p))
	for (let i = 0; i < num; ++i) {
		let x = pos[2 * i]
		let y = pos[2 * i + 1]

		// If y (odd): p * -1.1. If x (even): p.
		y = y * -1.1

		const lon = centerLon + x * scale
		const lat = centerLat + y * scale
		const time = timestamps[i]
		pathsData.push([2, lon, lat, time])
	}

	// 3. Points (Scatter) Data
	// pos = pos.map((p, i) => (i % 2 === 1 ? p * 1.5 : p))
	const scatterData = []
	for (let i = 0; i < num; ++i) {
		let x = pos[2 * i]
		let y = pos[2 * i + 1]

		// If y (odd): p * 1.5. If x (even): p.
		y = y * 1.5

		const lon = centerLon + x * scale
		const lat = centerLat + y * scale

		// color logic
		// color[i * 4 + 0] = 1 * 255
		// color[i * 4 + 1] = ((num - i) / num) * 1 * 255
		// color[i * 4 + 2] = 0 * 255
		// color[i * 4 + 3] = 0.3 * 255
		const r = 1
		const g = (num - i) / num
		const b = 0
		const a = 0.3

		// size logic
		// size[i] = Math.abs(Math.sin(((2 * Math.PI) / num) * i)) * 10 + 10
		const radius = Math.abs(Math.sin(((2 * Math.PI) / num) * i)) * 10 + 10

		scatterData.push([lon, lat, r, g, b, a, radius, `点${i}`])
	}

	return { heatmapData, pathsData, scatterData }
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
			const gmap = gmapRef.current
			gmap.on('mousedown', (e) => {
				console.log('mousedown', e)
			})
			gmap.on('mouseup', (e) => {
				console.log('mouseup', e)
			})
			gmap.on('click', (e) => {
				console.log('click', e)
			})
			gmap.on('rightclick', (e) => {
				console.log('rightclick', e)
			})
			gmap.on('dblclick', (e) => {
				console.log('dblclick', e)
			})
			// gmap.on('drag', (e) => {
			// 	console.log('drag', e)
			// })
			// gmap.on('hover', (e) => {
			// 	console.log('hover', e)
			// })

			// 初始视角定位到北京附近
			gmapRef.current.view.setCenter([116.4, 39.9])
			gmapRef.current.view.setZoom(10) // Zoom in a bit

			const { heatmapData, pathsData, scatterData } = generateDemoData(200000)

			// 1. Heatmap Layer
			// const heatmapLayer = gmapRef.current.addLayer('heatmap-layer', 'heatmap', {
			// 	fields: {
			// 		lon: 0,
			// 		lat: 1,
			// 		startTime: 2,
			// 	},
			// 	style: {
			// 		radius: 30,
			// 		blur: 0.8,
			// 		colorList: [
			// 			[1, 0, 0, 0],
			// 			[0.9, 0.9, 0, 0],
			// 			[0.1, 0.8, 0.2, 0],
			// 			[0, 0.0, 1.0, 0],
			// 			[0, 0, 0, 0],
			// 		],
			// 		colorOffsets: [1, 0.85, 0.45, 0.25, 0],
			// 		blending: 'normalBlending',
			// 	},
			// })
			// heatmapLayer.updateData(heatmapData)
			// heatmapLayer.setLevel(1)

			// 2. Path Layer
			// const pathLayer = gmapRef.current.addLayer('path-layer', 'path', {
			// 	fields: {
			// 		pathId: 0,
			// 		lon: 1,
			// 		lat: 2,
			// 		startTime: 3,
			// 	},
			// 	style: {
			// 		color: [1, 0.3, 0.2, 0.9],
			// 		lineWidth: 10,
			// 		headPointColor: [1, 0.9, 0.3, 1],
			// 		headPointSize: 10,
			// 		headPointVisible: false,
			// 		blending: 'normalBlending',
			// 		drawLine: false,
			// 		trailDuration: 0,
			// 	},
			// 	getPathStyle: (pathId) => {
			// 		if (String(pathId) === '1') {
			// 			return {
			// 				// pathId 1 specific style
			// 				tailDuration: 3, // seconds
			// 			}
			// 		} else if (String(pathId) === '2') {
			// 			return {
			// 				// pathId 2 specific style
			// 				color: [1, 1, 0, 0.7],
			// 				headPointVisible: true,
			// 				headPointSize: 15,
			// 				drawLine: true,
			// 			}
			// 		}
			// 		return {}
			// 	},
			// })
			// pathLayer.updateData(pathsData)
			// pathLayer.setLevel(2)

			// 3. Scatter Layer
			const scatterLayer = gmapRef.current.addLayer('scatter-points', 'scatter', {
				fields: {
					lon: 0,
					lat: 1,
					labelFields: {
						field: 7,
						title: ['点名称'],
					},
				},
				getColor: (row) => [Number(row[2]), Number(row[3]), Number(row[4]), Number(row[5])],
				getRadius: (row) => Number(row[6]),
				style: {
					color: [0.2, 0.6, 1.0, 0.8],
					radius: 6,
					highlight: {
						color: [1.0, 0.3, 0.3, 1.0],
						radius: 12,
					},
					blending: 'normalBlending',
				},
			})
			scatterLayer.updateData(scatterData)
			scatterLayer.setLevel(0)

			// Animation Loop
			let start = 0
			const animate = (time: number) => {
				if (start === 0) start = time
				const elapsed = time - start

				const cycleDuration = 8000
				const loopTime = ((elapsed % cycleDuration) / cycleDuration) * 20000

				if (gmapRef.current) {
					gmapRef.current.currentTime = loopTime
				}
				requestAnimationFrame(animate)
			}
			requestAnimationFrame(animate)
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
