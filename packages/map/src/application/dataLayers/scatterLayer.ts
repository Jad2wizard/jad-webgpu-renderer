import * as _ from 'lodash'
import { IDataLayer, BaseLayer, IBaseLayerProps, Data, LabelFields, StyleParams } from './layer'
import { Points } from '@gmap/renderer'
import { Color } from '@/types'
import { delay } from '@/utils'
import GMap from '..'

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
}

const defaultStyle: DeepRequired<StyleType> = {
	color: [212 / 255, 47 / 255, 40 / 255, 1],
	radius: 8,
	highlight: {
		color: [255 / 255, 27 / 255, 20 / 255, 1],
		radius: 15,
	},
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
	private step = 100000
	private style: DeepRequired<StyleType> = { ...defaultStyle }
	private getColor: IProps['getColor']
	private getRadius: IProps['getRadius']
	private total?: number
	private inputData: Data
	private map: GMap

	constructor(props: IBaseLayerProps & IProps) {
		super(props)
		this.map = props.map
		this.getColor = props.getColor
		this.getRadius = props.getRadius
		this.total = props.total
		this.fields = props.fields
		this.style = _.merge(this.style, props.style)
		this.inputData = []
		//@ts-ignore
		window.s = this
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

	async updateData(data: Data) {
		const total = this.total || data.length
		this.inputData = data
		let current = 0
		while (current < total) {
			await this.appendData(
				data.slice(current, current + Math.min(total - current, this.step))
			)
			current += this.step
			await delay(50)
		}
		return true
	}

	async appendData(data: Data) {
		const { positions, startTimes, colors, radiuses } = this.parseData(data)
		if (!positions) {
			throw new Error('缺少经纬度数据')
		}
		if (!this.points) {
			this.points = new Points({
				id: 'points-demo',
				position: positions,
				startTime: startTimes,
				color: colors,
				radius: radiuses,
				style: {
					color: this.style.color,
					radius: this.style.radius,
					blending: 'normalBlending',
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
		this.inputData.push(...data)
		return true
	}

	// 更新pointIndices 中的散点样式，或直接设置 uniform 样式
	updateStyle(style: StyleParams, pointIndices?: number[]) {
		if (!pointIndices) {
			this.style = _.merge(this.style, style)
		}
		if (!this.points) return Promise.resolve(false)
		this.points.setStyle(style, pointIndices)
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
	}

	dispose() {
		this.clearAll()
		//@ts-ignore
		this.map = undefined
	}

	private parseData(data: Data) {
		const len = data.length
		const positions = new Float32Array(len * 2)

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
			const lon = Number(row[this.fields.lon])
			const lat = Number(row[this.fields.lat])
			const { x, y } = this.map.getView().lonlat2World(lon, lat)
			positions[i * 2 + 0] = x
			positions[i * 2 + 1] = y
			if (this.fields.startTime && startTimes) {
				const st = Number(data[i][this.fields.startTime as number]) / 1000
				startTimes[i] = st - this.startTime
			}
			if (this.getRadius && radiuses) {
				radiuses[i] = this.getRadius(row)
			}
			if (colors && this.getColor) {
				const color = this.getColor(row)
				colors[i * 4 + 0] = color[0] * 255
				colors[i * 4 + 1] = color[1] * 255
				colors[i * 4 + 2] = color[2] * 255
				colors[i * 4 + 3] = color[3] * 255
			}
		}
		return { positions, startTimes, colors, radiuses }
	}
}

export default ScatterLayer
