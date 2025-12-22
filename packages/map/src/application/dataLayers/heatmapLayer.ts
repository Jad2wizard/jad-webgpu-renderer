import * as _ from 'lodash'
import { IDataLayer, BaseLayer, IBaseLayerProps, Data, LabelFields, StyleParams } from './layer'
import { Heatmap } from '@webgpu-gmap/renderer'
import { Blending } from '@map/types'
import { Color as RendererColor } from '@webgpu-gmap/renderer/src/types'
import { delay, parsePositionsAndExtent } from '@map/utils'
import GMap from '..'

type FieldsType = LabelFields & {
	lon: number
	lat: number
	startTime?: number
}

export type StyleType = {
	colorList?: [RendererColor, RendererColor, RendererColor, RendererColor, RendererColor]
	colorOffsets?: [number, number, number, number, number]
	blur?: number
	radius?: number
	blending?: Blending
}

const defaultStyle: DeepRequired<StyleType> = {
	colorList: [
		[1, 0, 0, 0],
		[0.9, 0.9, 0, 0],
		[0.1, 0.8, 0.2, 0],
		[0, 0.0, 1.0, 0],
		[0, 0, 0, 0],
	],
	colorOffsets: [1, 0.85, 0.45, 0.25, 0],
	blur: 0.8,
	radius: 30,
	blending: 'normalBlending',
}

export type IProps = {
	fields: FieldsType
	style?: StyleType
	total?: number
}

class HeatmapLayer extends BaseLayer implements IDataLayer {
	private heatmap?: Heatmap
	private fields: FieldsType
	private step = 100000
	private style: DeepRequired<StyleType> = { ...defaultStyle }
	private total?: number
	private inputData: Data
	private map?: GMap
	private updateToken = 0

	constructor(props: IBaseLayerProps & IProps) {
		super(props)
		this.map = props.map
		this.total = props.total
		this.fields = props.fields
		this.style = _.merge(this.style, props.style)
		this.inputData = []
	}

	setSelected(selected: boolean) {
		this.selected = selected
		return Promise.resolve(true)
	}

	setVisible(visible: boolean) {
		this.visible = visible
		if (this.heatmap) this.heatmap.visible = visible
		return Promise.resolve(true)
	}

	setLevel(level: number) {
		this.level = level
		if (this.heatmap) this.heatmap.renderOrder = level
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

		const { positions, startTimes, extent } = this.parseData(data)

		// 合并 extent
		this.updateExtent(extent)

		if (!this.heatmap) {
			this.heatmap = new Heatmap({
				id: this.id,
				points: positions,
				startTime: startTimes,
				total: this.total || data.length, // Ensure total is at least current length
				style: this.style,
			})
			this.scene.addModel(this.heatmap)
		} else {
			this.heatmap.appendHeatPoints(positions, startTimes)
		}
		this.inputData.push(...data)

		// 触发自动聚焦检查
		this.map.checkAutoFit()

		return true
	}

	updateStyle(style: StyleParams) {
		this.style = _.merge(this.style, style)
		if (!this.heatmap) return Promise.resolve(false)
		this.heatmap.setStyle(style as StyleType)
		return Promise.resolve(true)
	}

	onTimeUpdate(time: number): void {
		if (this.heatmap && this.fields.startTime) {
			this.heatmap.updateCurrentTime(time / 1000 - this.startTime)
		}
	}

	clearAll() {
		if (this.heatmap) {
			this.scene.removeModel(this.heatmap)
			this.heatmap.dispose()
			this.heatmap = undefined
		}
		this.extent = undefined
	}

	dispose() {
		this.clearAll()
		this.map = undefined
	}

	private parseData(data: Data) {
		const len = data.length

		// 1. 调用通用方法解析位置和 Extent
		const { positions, extent } = parsePositionsAndExtent(
			data,
			this.fields.lon,
			this.fields.lat,
			(lon, lat) => this.map!.getView().lonlat2World(lon, lat)
		)

		// 2. 解析 Heatmap 特有的属性（startTime）
		const startTimes = !!this.fields.startTime ? new Float32Array(len) : undefined

		if (!!this.fields.startTime) {
			for (let i = 0; i < len; i++) {
				const st = Number(data[i][this.fields.startTime]) / 1000
				this.startTime = Math.min(this.startTime, st)
			}

			for (let i = 0; i < len; ++i) {
				const st = Number(data[i][this.fields.startTime]) / 1000
				startTimes![i] = st - this.startTime
			}
		}

		return { positions, startTimes, extent }
	}
}

export default HeatmapLayer
