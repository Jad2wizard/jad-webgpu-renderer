import createKDTree from './kdtree'
import { Points } from '@webgpu-gmap/renderer'
// @ts-ignore
import ndarray from 'ndarray'

export class PointsIndexTree {
	private tree: any
	private _maxPointRadius: number = 0

	constructor() {}

	public getTree() {
		return this.tree
	}

	public rebuildFromData(
		positions: Float32Array,
		count: number,
		defaultRadius: number,
		getRadius?: (index: number) => number
	) {
		this.dispose()
		if (!positions || count === 0) return

		// Use Float32Array directly for ndarray
		const points = ndarray(positions.subarray(0, count * 2), [count, 2])
		this.tree = createKDTree(points)

		// Update max radius
		let maxR = defaultRadius || 0

		// Optimization: only if we have custom radii
		if (getRadius) {
			for (let i = 0; i < count; i++) {
				const r = getRadius(i)
				if (r !== undefined && r > maxR) {
					maxR = r
				}
			}
		}
		this._maxPointRadius = maxR
	}

	public rebuild(points: Points, defaultRadius: number, getRadius?: (index: number) => number) {
		this.dispose()
		if (!points) return

		const positionAttr = points.geometry.getAttribute('position')
		const radiusStorage = points.getRadiusStorage()

		if (positionAttr && positionAttr.array) {
			const positions = positionAttr.array
			const count = points.geometry.instanceCount
			const pointsArray: any[] = []
			for (let i = 0; i < count; i++) {
				pointsArray.push([positions[i * 2], positions[i * 2 + 1]])
			}
			this.tree = createKDTree(pointsArray)

			// Update max radius
			let maxR = defaultRadius || 0

			// Optimization: only if we have custom radii
			if (getRadius) {
				// We can iterate over all points and check radius
				for (let i = 0; i < count; i++) {
					const r = radiusStorage.getPointRadius(i)
					if (r !== undefined && r > maxR) {
						maxR = r
					}
				}
			}
			this._maxPointRadius = maxR
		}
	}

	public query(
		x: number,
		y: number,
		resolution: number,
		points: Points,
		defaultRadius: number
	): number[] {
		if (!this.tree || !points) return []

		// Thresholds in world units
		// Condition: dist < 3px OR dist < pointRadius
		// We need to query a range that covers the maximum possible influence.
		// Influence = max(3px, maxPointRadius)
		const thresholdPx = 3
		// Max radius of any point in the dataset (or style default)
		const maxRPx = Math.max(defaultRadius || 0, this._maxPointRadius)

		// Search radius in pixels (safe upper bound)
		const searchRadiusPx = Math.max(thresholdPx, maxRPx)

		// Convert to world units
		const searchRadiusWorld = searchRadiusPx * resolution

		// Range query box: [minX, minY, maxX, maxY]
		const range = [
			x - searchRadiusWorld,
			y - searchRadiusWorld,
			x + searchRadiusWorld,
			y + searchRadiusWorld,
		]

		const indices: number[] = []
		const positionAttr = points.geometry.getAttribute('position')
		const positions = positionAttr?.array
		const radiusStorage = points.getRadiusStorage()
		const styleRadius = defaultRadius || 0

		// Perform range search
		this.tree.range([range[0], range[1]], [range[2], range[3]], (index: number) => {
			if (!positions) return

			const px = positions[index * 2]
			const py = positions[index * 2 + 1]
			const dx = px - x
			const dy = py - y
			const distSq = dx * dx + dy * dy // World distance squared

			// Get point radius
			let pointRadius = styleRadius
			if (radiusStorage.hasData) {
				const r = radiusStorage.getPointRadius(index)
				if (r !== undefined) pointRadius = r
			}

			// Thresholds in world units squared
			const toleranceWorld = 3.0 * resolution
			const radiusWorld = pointRadius * resolution
			console.log(radiusWorld)

			// Selection Logic
			if (distSq < toleranceWorld * toleranceWorld || distSq < radiusWorld * radiusWorld) {
				indices.push(index)
			}
		})

		return indices
	}

	public dispose() {
		if (this.tree) {
			this.tree.dispose()
			this.tree = undefined
		}
		this._maxPointRadius = 0
	}
}
