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
		attributions: '© OpenStreetMap contributors'
	})

	return new TileLayer({
		source,
	})
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
