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

		const total = Math.min(this.total ?? data.length, data.length)
		let current = 0
		while (current < total) {
			if (this.updateToken !== token) return false

			const chunk = data.slice(current, current + Math.min(total - current, this.step))
			await this.appendData(chunk)
			current += this.step
			await delay(50)
		}
		return true
	}

	async appendData(data: Data) {
		if (data.length === 0) return true
		if (!this.map) return false

		const { positions, startTimes, colors, radiuses, extent } = this.parseData(data)

		this.updateExtent(extent)

		if (!this.points) {
			this.points = new Points({
				id: this.id,
				position: positions,
				startTime: startTimes,
				color: colors,
				radius: radiuses,
				style: {
					color: this.style.color,
					radius: this.style.radius,
					blending: this.style.blending,
				},
			})
			this.scene.addModel(this.points)
		} else {
			this.points.appendPoints({
				position: positions,
				startTime: startTimes,
				color: colors,
				radius: radiuses,
			})
		}
		for (let item of data) this.inputData.push(item)

		this.map.checkAutoFit()

		// Rebuild KDTree
		if (this.points) {
			this.indexTree.rebuild(
				this.points,
				this.style.radius,
				this.getRadius
					? (i) => {
							// We don't have direct access to row data by index efficiently here without keeping it around or passing it.
							// But we have radiusStorage in Points which is what rebuild uses.
							// rebuild method in PointsIndexTree accepts getRadius as (index) => number.
							// We need to implement logic inside PointsIndexTree to use radiusStorage directly if possible,
							// or pass a callback that queries radiusStorage.
							// The previous implementation used radiusStorage.getPointRadius(i).
							return 0 // This callback is actually for optimization logic inside rebuild.
							// Let's refactor rebuild to not need this callback if it can access radiusStorage from points.
						}
					: undefined
			)
			// Actually let's simplify rebuild signature in next step or use what we wrote.
			// PointsIndexTree.rebuild(points, defaultRadius, getRadius?)
			// If getRadius is provided, it updates maxRadius.

			// We can just pass a function that delegates to points.getRadiusStorage().getPointRadius(i)
			this.indexTree.rebuild(
				this.points,
				this.style.radius,
				this.getRadius
					? (i) => {
							return this.points!.getRadiusStorage().getPointRadius(i) ?? 0
						}
					: undefined
			)
		}

		return true
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
