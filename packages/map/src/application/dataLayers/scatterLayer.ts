import * as _ from 'lodash'
import { IDataLayer, BaseLayer, IBaseLayerProps, Data, LabelFields, StyleParams } from './layer'
import { Points } from '@webgpu-gmap/renderer'
import { Color, Blending } from '@map/types'
import { delay, parsePositionsAndExtent } from '@map/utils'
import GMap from '..'
import { PointsIndexTree } from '../indexTree/pointsIndexTree'

type FieldsType = LabelFields & {
	lon: number
	lat: number
	startTime?: number
}

type StyleType = {
	color?: Color
	radius?: number
	highlight?: {
		color?: Color
		radius?: number
	}
	blending?: Blending
}

const defaultStyle: DeepRequired<StyleType> = {
	color: [212 / 255, 47 / 255, 40 / 255, 1],
	radius: 8,
	highlight: {
		color: [255 / 255, 27 / 255, 20 / 255, 1],
		radius: 15,
	},
	blending: 'normalBlending',
}

export type IProps = {
	fields: FieldsType
	style?: StyleType
	getColor?: (row: (string | number)[]) => Color
	getRadius?: (row: (string | number)[]) => number
	total?: number
}

class ScatterLayer extends BaseLayer implements IDataLayer {
	private points?: Points
	private fields: FieldsType
	private step = 1000000
	private style: DeepRequired<StyleType> = { ...defaultStyle }
	private getColor: IProps['getColor']
	private getRadius: IProps['getRadius']
	private total?: number
	private inputData: Data
	private map?: GMap
	private updateToken = 0
	private indexTree: PointsIndexTree
	private currentCount = 0

	constructor(props: IBaseLayerProps & IProps) {
		super(props)
		this.map = props.map
		this.getColor = props.getColor
		this.getRadius = props.getRadius
		this.total = props.total
		this.fields = props.fields
		this.style = _.merge(this.style, props.style)
		this.inputData = []
		this.indexTree = new PointsIndexTree()
		this.currentCount = 0
	}

	setSelected(selected: boolean) {
		this.selected = selected
		return Promise.resolve(true)
	}

	setVisible(visible: boolean) {
		this.visible = visible
		if (this.points) this.points.visible = visible
		return Promise.resolve(true)
	}

	setLevel(level: number) {
		this.level = level
		if (this.points) this.points.renderOrder = level
		return Promise.resolve(true)
	}

	async updateData(data: Data, _fields?: LabelFields, style?: StyleParams) {
		const token = ++this.updateToken
		if (style) {
			this.updateStyle(style)
		}

		this.clearAll()
		this.inputData = []
		this.currentCount = 0

		const total = Math.min(this.total ?? data.length, data.length)
		let current = 0
		while (current < total) {
			if (this.updateToken !== token) return false

			const chunk = data.slice(current, current + Math.min(total - current, this.step))
			await this.appendData(chunk, false)
			current += this.step
			await delay(50)
		}

		this.rebuild()
		return true
	}

	async appendData(data: Data, update = true) {
		if (data.length === 0) return true
		if (!this.map) return false

		const { positions, startTimes, colors, radiuses, extent } = this.parseData(data)
		this.updateExtent(extent)

		const newCount = data.length
		const totalCount = this.currentCount + newCount

		let combinedPositions: Float32Array
		let combinedColors: Uint8Array | undefined
		let combinedRadiuses: Uint8Array | undefined
		let combinedStartTimes: Float32Array | undefined

		// Merge with existing data in Points (if any)
		if (this.points) {
			const curPositions = this.points.getAttribute('position') as Float32Array
			const curColors = this.points.getAttribute('color') as Uint8Array
			const curStartTimes = this.points.getAttribute('startTime') as Float32Array
			const curRadiuses = this.points.getRadiusStorage().value as Uint8Array

			combinedPositions = new Float32Array(totalCount * 2)
			if (curPositions) combinedPositions.set(curPositions)
			combinedPositions.set(positions, this.currentCount * 2)

			if (colors || curColors) {
				combinedColors = new Uint8Array(totalCount * 4)
				if (curColors) combinedColors.set(curColors)
				if (colors) {
					combinedColors.set(colors, this.currentCount * 4)
				} else if (curColors) {
					// Fill new part with default color
					const defaultColor = new Uint8Array([
						this.style.color[0] * 255,
						this.style.color[1] * 255,
						this.style.color[2] * 255,
						this.style.color[3] * 255,
					])
					for (let i = 0; i < newCount; i++) {
						combinedColors.set(defaultColor, (this.currentCount + i) * 4)
					}
				}
			}

			if (radiuses || (curRadiuses && curRadiuses.length > 0)) {
				combinedRadiuses = new Uint8Array(totalCount)
				if (curRadiuses) combinedRadiuses.set(curRadiuses.subarray(0, this.currentCount))
				if (radiuses) {
					combinedRadiuses.set(radiuses, this.currentCount)
				} else {
					combinedRadiuses.fill(this.style.radius, this.currentCount)
				}
			}

			if (startTimes || curStartTimes) {
				combinedStartTimes = new Float32Array(totalCount)
				if (curStartTimes) combinedStartTimes.set(curStartTimes)
				if (startTimes) combinedStartTimes.set(startTimes, this.currentCount)
			}
		} else {
			combinedPositions = positions
			combinedColors = colors
			combinedRadiuses = radiuses
			combinedStartTimes = startTimes
		}

		this.currentCount = totalCount
		for (let item of data) this.inputData.push(item)

		// Linear index array for sequential rendering of current (unsorted) data
		const indexArray = new Uint32Array(this.currentCount)
		for (let i = 0; i < this.currentCount; i++) indexArray[i] = i

		// Create or Update Points model with combined (unsorted) data immediately
		if (!this.points) {
			this.points = new Points({
				id: this.id,
				position: combinedPositions,
				index: indexArray,
				startTime: combinedStartTimes,
				color: combinedColors,
				radius: combinedRadiuses,
				style: {
					color: this.style.color,
					radius: this.style.radius,
					blending: this.style.blending,
				},
				total: this.currentCount,
			})
			this.scene.addModel(this.points)
		} else {
			this.points.setTotal(this.currentCount)
			this.points.updateAttribute('position', combinedPositions)
			if (combinedColors) this.points.updateAttribute('color', combinedColors)
			if (combinedRadiuses) this.points.getRadiusStorage().updateValue(combinedRadiuses)
			if (combinedStartTimes) this.points.updateAttribute('startTime', combinedStartTimes)

			this.points.geometry.setIndex(indexArray)
		}

		this.map.checkAutoFit()

		if (update) {
			this.rebuild()
		}

		return true
	}

	private rebuild() {
		if (!this.points || this.currentCount === 0) return

		// Retrieve current attributes (which might be a mix of sorted and new unsorted data)
		const currentPositions = this.points.getAttribute('position') as Float32Array
		const currentColors = this.points.getAttribute('color') as Uint8Array
		const currentRadiuses = this.points.getRadiusStorage().value as Uint8Array
		const currentStartTimes = this.points.getAttribute('startTime') as Float32Array

		// Rebuild Tree with current data
		this.indexTree.rebuildFromData(
			currentPositions,
			this.currentCount,
			this.style.radius,
			this.getRadius
				? (i) => {
						if (currentRadiuses) return currentRadiuses[i]
						return 0
					}
				: undefined
		)

		const tree = this.indexTree.getTree()
		if (!tree) return

		const sortedPositions = tree.points.data // TypedArray (Sorted)
		const ids = tree.ids // Int32Array (Permutation indices)

		// Sort attributes based on new tree ids
		let sortedColors: Uint8Array | undefined
		if (currentColors) {
			sortedColors = new Uint8Array(this.currentCount * 4)
			for (let i = 0; i < this.currentCount; i++) {
				const originalIndex = ids[i]
				sortedColors[i * 4 + 0] = currentColors[originalIndex * 4 + 0]
				sortedColors[i * 4 + 1] = currentColors[originalIndex * 4 + 1]
				sortedColors[i * 4 + 2] = currentColors[originalIndex * 4 + 2]
				sortedColors[i * 4 + 3] = currentColors[originalIndex * 4 + 3]
			}
		}

		let sortedRadiuses: Uint8Array | undefined
		if (currentRadiuses) {
			// Ensure alignment to 4 bytes for WebGPU
			const alignedSize = Math.ceil(this.currentCount / 4) * 4
			sortedRadiuses = new Uint8Array(alignedSize)
			for (let i = 0; i < this.currentCount; i++) {
				const originalIndex = ids[i]
				sortedRadiuses[i] = currentRadiuses[originalIndex]
			}
		}

		let sortedStartTimes: Float32Array | undefined
		if (currentStartTimes) {
			sortedStartTimes = new Float32Array(this.currentCount)
			for (let i = 0; i < this.currentCount; i++) {
				const originalIndex = ids[i]
				sortedStartTimes[i] = currentStartTimes[originalIndex]
			}
		}

		// Update Points model with SORTED attributes
		this.points.updateAttribute('position', sortedPositions)
		if (sortedColors) this.points.updateAttribute('color', sortedColors)
		if (sortedRadiuses) this.points.getRadiusStorage().updateValue(sortedRadiuses)
		if (sortedStartTimes) this.points.updateAttribute('startTime', sortedStartTimes)

		// Permute inputData to match the sorted order
		const oldInputData = new Array(this.currentCount)
		for (let i = 0; i < this.currentCount; i++) {
			oldInputData[i] = this.inputData[ids[i]]
		}
		for (let i = 0; i < this.currentCount; i++) {
			this.inputData[i] = oldInputData[i]
		}
	}

	// 更新pointIndices 中的散点样式，或直接设置 uniform 样式
	updateStyle(style: StyleParams, pointIndices?: number[]) {
		if (!pointIndices) {
			this.style = _.merge(this.style, style)
		}
		if (!this.points) return Promise.resolve(false)
		this.points.setStyle(style as any, pointIndices)
		return Promise.resolve(true)
	}

	onTimeUpdate(time: number): void {
		if (this.points && this.fields.startTime) {
			this.points.updateCurrentTime(time / 1000 - this.startTime)
		}
	}

	clearAll() {
		if (this.points) {
			this.scene.removeModel(this.points)
			this.points.dispose()
			this.points = undefined
		}
		this.extent = undefined
	}

	dispose() {
		this.clearAll()
		this.map = undefined
	}

	async pick(x: number, y: number): Promise<Data> {
		if (!this.points || !this.map) return []

		const resolution = this.map.view.getResolution()
		const s = performance.now()

		console.log(`x: ${x}, y: ${y}, resolution: ${resolution}, radius: ${this.style.radius}`)
		const indices = this.indexTree.query(x, y, resolution, this.points, this.style.radius)

		console.log(`pick ${indices.length} points in ${performance.now() - s}ms`)
		const pickedData: Data = []
		for (const index of indices) {
			if (this.inputData[index]) {
				pickedData.push(this.inputData[index])
			}
		}
		return pickedData
	}

	private parseData(data: Data) {
		const len = data.length

		const { positions, extent } = parsePositionsAndExtent(
			data,
			this.fields.lon,
			this.fields.lat,
			(lon, lat) => this.map!.view.lonlat2WorldFast(lon, lat)
		)

		const startTimes = !!this.fields.startTime ? new Float32Array(len) : undefined
		const radiuses = this.getRadius ? new Uint8Array(len) : undefined
		const colors = this.getColor ? new Uint8Array(len * 4) : undefined

		if (!!this.fields.startTime) {
			for (let i = 0; i < len; i++) {
				const st = Number(data[i][this.fields.startTime]) / 1000
				this.startTime = Math.min(this.startTime, st)
			}
		}

		for (let i = 0; i < len; ++i) {
			const row = data[i]

			if (this.fields.startTime && startTimes) {
				const st = Number(data[i][this.fields.startTime as number]) / 1000
				startTimes[i] = st - this.startTime
			}
			if (this.getRadius && radiuses) {
				const r = this.getRadius(row)
				radiuses[i] = Math.max(0, Math.min(255, Math.round(r)))
			}
			if (colors && this.getColor) {
				const color = this.getColor(row)
				colors[i * 4 + 0] = Math.max(0, Math.min(255, Math.round(color[0] * 255)))
				colors[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(color[1] * 255)))
				colors[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(color[2] * 255)))
				colors[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(color[3] * 255)))
			}
		}

		return { positions, startTimes, colors, radiuses, extent }
	}
}

export default ScatterLayer
