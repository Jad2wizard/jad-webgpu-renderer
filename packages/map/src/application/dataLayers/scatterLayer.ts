import * as _ from 'lodash'
import { IDataLayer, BaseLayer, IBaseLayerProps, Data, LabelFields, StyleParams } from './layer'
import { Points } from '@webgpu-gmap/renderer'
import { Color, Blending } from '@map/types'
import { delay, parsePositionsAndExtent } from '@map/utils'
import GMap from '..'
import { PointsIndexTree } from '../indexTree/pointsIndexTree'

// @ts-ignore
import * as pool from 'typedarray-pool'

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
	private map?: GMap
	private updateToken = 0 // 更新token，用于判断是否需要 执行 updateData 方法更新图层数据
	private indexTree: PointsIndexTree
	private currentCount = 0
	private treeIds?: Int32Array

	constructor(props: IBaseLayerProps & IProps) {
		super(props)
		this.map = props.map
		this.getColor = props.getColor
		this.getRadius = props.getRadius
		this.total = props.total
		this.fields = props.fields
		this.style = _.merge(this.style, props.style)
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
		this.currentCount = 0

		const total = Math.min(this.total ?? data.length, data.length)
		let current = 0
		while (current < total) {
			// 旧的 updateData 调用中，token 仍然是旧值， 与 updateToken 判断是否需要提前退出
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

		const newCount = data.length

		if (!this.points) {
			const totalCapacity = this.total ?? this.currentCount + newCount
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
				total: totalCapacity,
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

		this.currentCount = this.points.geometry.instanceCount

		this.map.checkAutoFit()

		return true
	}

	public buildIndexTree() {
		if (!this.points || this.currentCount === 0) return

		const positionAttr = this.points.geometry.getAttribute('position')
		const currentPositions = positionAttr?.array as Float32Array | undefined
		if (!currentPositions) return

		const radiusStorage = this.points.getRadiusStorage()
		const currentRadiuses = radiusStorage.hasData
			? (radiusStorage.value as Uint8Array)
			: undefined

		this.indexTree.rebuildFromData(
			currentPositions,
			this.currentCount,
			this.style.radius,
			this.getRadius
				? (i) => {
						if (currentRadiuses) return currentRadiuses[i]
						return this.style.radius
					}
				: undefined
		)

		const tree = this.indexTree.getTree()
		if (tree) {
			const sortedPositions = tree.points.data
			const ids = tree.ids
			const count = this.currentCount

			// 重用 kdtree.points 作为 position attribute
			const positionAttr = this.points.geometry.getAttribute('position')
			if (positionAttr) {
				positionAttr.array = sortedPositions
				positionAttr.needsUpdate = true
				// @ts-ignore
				positionAttr.capacity = sortedPositions.length / positionAttr.itemSize
				// 同时更新 Points 的 _total
				// @ts-ignore
				this.points._total = count
			}

			// 根据 kdtree.ids 重排其他属性
			const colorAttr = this.points.geometry.getAttribute('color')
			if (colorAttr && colorAttr.array) {
				const oldColors = colorAttr.array
				const newColors = new Uint8Array(count * 4)
				for (let i = 0; i < count; i++) {
					const id = ids[i]
					newColors[i * 4 + 0] = oldColors[id * 4 + 0]
					newColors[i * 4 + 1] = oldColors[id * 4 + 1]
					newColors[i * 4 + 2] = oldColors[id * 4 + 2]
					newColors[i * 4 + 3] = oldColors[id * 4 + 3]
				}
				colorAttr.array = newColors
				colorAttr.needsUpdate = true
				// @ts-ignore
				colorAttr.capacity = newColors.length / colorAttr.itemSize
			}

			const startTimeAttr = this.points.geometry.getAttribute('startTime')
			if (startTimeAttr && startTimeAttr.array) {
				const oldTimes = startTimeAttr.array
				const newTimes = new Float32Array(count)
				for (let i = 0; i < count; i++) {
					newTimes[i] = oldTimes[ids[i]]
				}
				startTimeAttr.array = newTimes
				startTimeAttr.needsUpdate = true
				// @ts-ignore
				startTimeAttr.capacity = newTimes.length / startTimeAttr.itemSize
			}

			const radiusStorage = this.points.getRadiusStorage()
			if (radiusStorage.hasData) {
				const oldRadiuses = radiusStorage.value as Uint8Array
				const alignedSize = Math.ceil(count / 4) * 4
				const newRadiuses = new Uint8Array(alignedSize)
				for (let i = 0; i < count; i++) {
					newRadiuses[i] = oldRadiuses[ids[i]]
				}
				radiusStorage.updateValue(newRadiuses)
			}

			this.treeIds = ids
			// 将 kdtree.points与 geometry的 position 共享 buffer，以及重排序其它 attributes 之后
			// tree.ids 就变成了简单的递增数组，失去了作为kdtree.points原始数据的索引的意义，故删掉
			pool.freeInt32(tree.ids)
			// @ts-ignore
			tree.ids = null
		}
	}

	// 更新pointIndices 中的散点样式，或直接设置 uniform 样式
	updateStyle(style: StyleParams, pointIndices?: number[]) {
		if (!pointIndices) {
			this.style = _.merge(this.style, style)
		}
		if (!this.points) return Promise.resolve(false)
		const pointsStyle: { color?: Color; radius?: number; blending?: Blending } = {}
		if (style.color) pointsStyle.color = style.color
		if (style.radius) pointsStyle.radius = style.radius
		if (style.blending) pointsStyle.blending = style.blending
		this.points.setStyle(pointsStyle, pointIndices)
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

	async pick(x: number, y: number): Promise<number[]> {
		if (!this.points || !this.map) return []

		//获取分辨率，单位是：米/像素
		const resolution = this.map.view.getResolution()
		const indices = this.indexTree.query(x, y, resolution, this.points, this.style.radius)
		const pickedIndices: number[] = []
		if (!this.treeIds) {
			return []
		}
		for (const index of indices) {
			pickedIndices.push(this.treeIds[index])
		}
		return pickedIndices
	}

	private parseData(data: Data) {
		const len = data.length

		const { positions, extent } = parsePositionsAndExtent(
			data,
			this.fields.lon,
			this.fields.lat,
			(lon, lat) => this.map!.view.lonlat2WorldFast(lon, lat)
		)

		const startTimeField = this.fields.startTime
		const startTimes = startTimeField !== undefined ? new Float32Array(len) : undefined
		const radiuses = this.getRadius ? new Uint8Array(len) : undefined
		const colors = this.getColor ? new Uint8Array(len * 4) : undefined

		if (startTimeField !== undefined) {
			for (let i = 0; i < len; i++) {
				const st = Number(data[i][startTimeField]) / 1000
				this.startTime = Math.min(this.startTime, st)
			}
		}

		for (let i = 0; i < len; ++i) {
			const row = data[i]

			if (startTimeField !== undefined && startTimes) {
				const st = Number(data[i][startTimeField]) / 1000
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
