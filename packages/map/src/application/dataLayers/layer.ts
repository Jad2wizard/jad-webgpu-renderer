import { Scene } from '@webgpu-gmap/renderer'
import { Extent } from '@map/types'
import GMap from '..'

export type LabelFields = { labelFields?: { field: number; title: string[] } }
export type StyleParams = Record<string, any>
export type Data = (number | string)[][]

export interface IDataLayer {
	getId(): string
	getSelected(): boolean
	getVisible(): boolean
	getLevel(): number
	updateData(data: Data, fields: LabelFields, style?: StyleParams): Promise<boolean>
	updateStyle(style: StyleParams): Promise<boolean>
	setSelected(setSelected: boolean): Promise<boolean>
	setVisible(setVisible: boolean): Promise<boolean>
	setLevel(setLevel: number): Promise<boolean>
	onTimeUpdate(time: number): void
	clearAll(): void
	dispose(): void
}

export type IBaseLayerProps = {
	id: string
	level: number
	scene: Scene
	map: GMap
}

export class BaseLayer {
	protected id: string
	protected selected: boolean
	protected visible: boolean
	protected level: number //level越小，图层的渲染优先级越低，重叠时会被其他图层遮挡
	protected extent?: Extent //layer 渲染的数据坐标在四个方向上的范围
	protected scene: Scene
	protected startTime = Infinity //记录渲染数据中的最小 startTime，用于计算相对时间，避免浮点数计算误差
	constructor(props: IBaseLayerProps) {
		this.id = props.id
		this.level = props.level
		this.scene = props.scene
		this.selected = false
		this.visible = true
		this.extent = undefined
	}

	getExtent() {
		return this.extent || null
	}

	getId() {
		return this.id
	}

	getSelected() {
		return this.selected
	}

	getVisible() {
		return this.visible
	}

	getLevel() {
		return this.level
	}
}
