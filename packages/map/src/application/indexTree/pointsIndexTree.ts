import createKDTree from './kdtree'
import { Points } from '@webgpu-gmap/renderer'
// @ts-expect-error ndarray has no bundled types here
import ndarray from 'ndarray'

type KDTreeLike = {
	range(lo: number[], hi: number[], visit: (index: number) => void): void
	dispose(): void
	points: { data: Float32Array }
	ids: Int32Array
}

export class PointsIndexTree {
	private tree?: KDTreeLike
	private _maxPointRadius: number = 0

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

		const points = ndarray(positions.subarray(0, count * 2), [count, 2])
		this.tree = createKDTree(points) as unknown as KDTreeLike

		let maxR = defaultRadius || 0

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

	public query(
		x: number,
		y: number,
		resolution: number,
		points: Points,
		defaultRadius: number
	): number[] {
		if (!this.tree || !points) return []

		const thresholdPx = 3 //设置的最小搜索半径
		const maxRPx = Math.max(defaultRadius || 0, this._maxPointRadius)

		const searchRadiusPx = Math.max(thresholdPx, maxRPx)

		const searchRadiusWorld = searchRadiusPx * resolution

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

		this.tree.range([range[0], range[1]], [range[2], range[3]], (index: number) => {
			if (!positions) return

			const px = positions[index * 2]
			const py = positions[index * 2 + 1]
			const dx = px - x
			const dy = py - y
			const distSq = dx * dx + dy * dy

			let pointRadius = styleRadius
			if (radiusStorage.hasData) {
				const r = radiusStorage.getPointRadius(index)
				if (r !== undefined) pointRadius = r
			}

			const toleranceWorld = 3.0 * resolution
			const radiusWorld = pointRadius * resolution

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
