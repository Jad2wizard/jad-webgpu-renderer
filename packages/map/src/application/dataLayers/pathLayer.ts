import * as _ from 'lodash'
import { IDataLayer, BaseLayer, IBaseLayerProps, Data, LabelFields, StyleParams } from './layer'
import { Paths } from '@webgpu-gmap/renderer'
import { Color, Blending } from '@map/types'
import { delay, parsePositionsAndExtent } from '@map/utils'
import GMap from '..'

type FieldsType = LabelFields & {
	pathId: number
	lon: number
	lat: number
	startTime?: number
}

type StyleType = {
	color?: Color
	lineWidth?: number
	headPointColor?: Color
	headPointSize?: number
	headPointVisible?: boolean
	drawLine?: boolean
	trailDuration?: number
	unplayedColor?: Color
	unplayedLineWidth?: number
	blending?: Blending
}

const defaultStyle: DeepRequired<StyleType> = {
	color: [1, 0.3, 0.2, 0.7],
	lineWidth: 5,
	headPointColor: [1, 0.9, 0.3, 1],
	headPointSize: 10,
	headPointVisible: false,
	drawLine: false,
	trailDuration: 0,
	unplayedColor: [0, 0, 0, 0.05],
	unplayedLineWidth: 5,
	blending: 'normalBlending',
}

export type IProps = {
	fields: FieldsType
	style?: StyleType
	getPathStyle?: (pathId: string | number) => StyleType
	total?: number
}

class PathLayer extends BaseLayer implements IDataLayer {
	private paths?: Paths
	private fields: FieldsType
	private step = 100000
	private style: DeepRequired<StyleType> = { ...defaultStyle }
	private getPathStyle: IProps['getPathStyle']
	private total?: number
	private inputData: Data
	private map?: GMap
	private updateToken = 0

	constructor(props: IBaseLayerProps & IProps) {
		super(props)
		this.map = props.map
		this.getPathStyle = props.getPathStyle
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
		if (this.paths) this.paths.visible = visible
		return Promise.resolve(true)
	}

	setLevel(level: number) {
		this.level = level
		if (this.paths) this.paths.renderOrder = level
		return Promise.resolve(true)
	}

	pickBox(minX: number, minY: number, maxX: number, maxY: number, resolution: number): number[] {
		return []
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

		const { pathPropsList, extent } = this.parseData(data)

		this.updateExtent(extent)

		if (!this.paths) {
			this.paths = new Paths(pathPropsList, this.style)
			this.scene.addModel(this.paths)
		} else {
			this.paths.appendPaths(pathPropsList)
		}
		this.inputData.push(...data)

		// 触发自动聚焦检查
		this.map.checkAutoFit()

		return true
	}

	updateStyle(style: StyleParams, pathIds?: string[]) {
		if (!pathIds) {
			this.style = _.merge(this.style, style)
		}
		if (!this.paths) return Promise.resolve(false)
		this.paths.setStyle(style as StyleType, pathIds)
		return Promise.resolve(true)
	}

	onTimeUpdate(time: number): void {
		if (this.paths && this.fields.startTime) {
			this.paths.updateCurrentTime(time / 1000 - this.startTime)
		}
	}

	clearAll() {
		if (this.paths) {
			this.scene.removeModel(this.paths)
			this.paths.dispose()
			this.paths = undefined
		}
		this.extent = undefined
	}

	dispose() {
		this.clearAll()
		this.map = undefined
	}

	private parseData(data: Data) {
		const pathsMap = new Map<string | number, Data>()
		const pathIdIdx = this.fields.pathId

		for (const row of data) {
			const pathId = row[pathIdIdx]
			if (!pathsMap.has(pathId)) {
				pathsMap.set(pathId, [])
			}
			pathsMap.get(pathId)!.push(row)
		}

		const pathPropsList: any[] = []
		let minLon = Infinity
		let maxLon = -Infinity
		let minLat = Infinity
		let maxLat = -Infinity

		for (const [pathId, rows] of pathsMap) {
			const len = rows.length

			const { positions, extent } = parsePositionsAndExtent(
				rows,
				this.fields.lon,
				this.fields.lat,
				(lon, lat) => this.map!.view.lonlat2WorldFast(lon, lat)
			)

			minLon = Math.min(minLon, extent.w)
			maxLon = Math.max(maxLon, extent.e)
			minLat = Math.min(minLat, extent.s)
			maxLat = Math.max(maxLat, extent.n)

			const startTimes = !!this.fields.startTime ? new Float32Array(len) : undefined

			if (this.fields.startTime && startTimes) {
				for (let i = 0; i < len; i++) {
					const row = rows[i]
					const st = Number(row[this.fields.startTime]) / 1000
					this.startTime = Math.min(this.startTime, st)
				}
			}

			if (this.fields.startTime && startTimes) {
				for (let i = 0; i < len; i++) {
					const row = rows[i]
					const st = Number(row[this.fields.startTime as number]) / 1000
					startTimes[i] = st - this.startTime
				}
			}

			const pathStyle = this.getPathStyle ? this.getPathStyle(pathId) : undefined

			pathPropsList.push({
				pathId: String(pathId),
				position: positions,
				startTime: startTimes,
				style: pathStyle,
			})
		}

		const extent = {
			w: minLon,
			e: maxLon,
			s: minLat,
			n: maxLat,
		}

		return { pathPropsList, extent }
	}
}

export default PathLayer
