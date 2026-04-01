import Geometry from '../geometry/geometry'
import Attribute from '../geometry/attribute'
import { BufferType } from '../backend/Buffer'
import PointMaterial from './pointMaterial'
import Model from '../Model'
import { Blending, Color, IPlayable } from '../types'
import { deepMerge, packUint8ToUint32 } from '../utils'
import RadiusStorage from './radiusStorage'
import Renderer from '../Renderer'
import { Camera } from '../camera/camera'
import { Pass } from '../pass/Pass'
import { PointsPass } from './PointsPass'

const defaultStyle = {
	radius: 8,
	color: [0.9, 0.3, 0.2, 0.7] as Color,
	blending: 'normalBlending' as Blending,
}

type IProps = {
	id: string
	position: Float32Array
	index?: Uint32Array
	radius?: Uint8Array
	color?: Uint8Array
	startTime?: Float32Array
	total?: number
	style?: {
		radius?: number
		color?: Color
		blending?: Blending
	}
}

import Storage from '../material/storage'
import Uniform from '../material/uniform'
import { makeShaderDataDefinitions } from 'webgpu-utils'

class Points extends Model implements IPlayable {
	private _playable = false
	private _total: number

	/**
	 * position 为散点坐标数组长度为2 * total，radius 为散点大小数组长度为2 * total，color 为散点颜色数组长度为4 * total（color的四个分量取值范围为0到1）
	 * radius, startTime 和 color可选，用于给每个散点单独设置大小, 时间和颜色，如果设置了 radius 和 color，renderer 会忽略 style.color|radius
	 * material可选，material.radius 设置模型中所有散点的大小默认值8，material.color 设置模型中所有散点的颜色默认值[1, 0, 0, 1]
	 * @param props
	 */
	constructor(props: IProps) {
		const geometry = new Geometry(props.id + '-geometry')
		const style = deepMerge(defaultStyle, props.style || {})
		const total = props.total || props.position.length / 2
		const radiusStorage = new RadiusStorage({
			id: props.id + '-radius-storage',
			data: props.radius,
			total,
		})
		const material = new PointMaterial({
			modelName: props.id,
			...defaultStyle,
			...style,
			radiusStorage,
			hasColorAttribute: !!props.color,
			hasTime: !!props.startTime,
			total,
		})

		super(props.id, geometry, material)

		this._style = style
		this._total = total
		this.initAttributes(props)
		if (props.index) {
			this.geometry.setIndex(props.index)
		}
		this._playable = !!props.startTime
	}

	get playable() {
		return this._playable
	}

	get material() {
		return this._material as PointMaterial
	}

	get total() {
		return this._total
	}

	public getPasses(renderer: Renderer, camera: Camera, loadOp: GPULoadOp = 'load'): Pass[] {
		return [
			new PointsPass(
				this,
				camera,
				'output',
				loadOp,
				loadOp === 'clear' ? renderer.clearColor : undefined
			),
		]
	}

	public getRadiusStorage() {
		return this.material.getStorage('radius') as RadiusStorage
	}

	private _ensureColorAttribute(): Uint8Array {
		let colorArray = this.getAttribute('color') as Uint8Array
		if (!colorArray) {
			const colorArray32 = new Uint32Array(this.total)
			const packedColor = packUint8ToUint32(this._style.color.map((c: number) => c * 255))
			colorArray32.fill(packedColor)
			colorArray = new Uint8Array(colorArray32.buffer)
			const colorAttribute = new Attribute('color', colorArray, 4, {
				stepMode: 'instance',
				shaderLocation: 1,
				capacity: this.total * 4,
			})
			this.geometry.setAttribute('color', colorAttribute)

			this.material.updateShaderCode(
				true,
				this.material.hasRadiusAttribute,
				this.material.hasTimeAttribute
			)
		}
		return colorArray
	}

	/**
	 * 批量更新散点的颜色
	 * @param params 每个元素为 [index, color]，index 为散点的索引，color 为新的颜色
	 */
	batchUpdateColor(params: [number, Color][]) {
		const colorArray = this._ensureColorAttribute()

		const len = params.length
		for (let idx = 0; idx < len; idx++) {
			const item = params[idx]
			const i = item[0]
			const color = item[1]

			const offset = i * 4
			// 使用位运算 `| 0` 显式转换为整型，避免隐式的向下截断
			colorArray[offset] = (color[0] * 255) | 0
			colorArray[offset + 1] = (color[1] * 255) | 0
			colorArray[offset + 2] = (color[2] * 255) | 0
			colorArray[offset + 3] = (color[3] * 255) | 0
		}

		this.updateAttribute('color', colorArray)
	}

	batchUpdateRadius(params: [number, number][]) {
		const radiusStorage = this.getRadiusStorage()
		if (!radiusStorage.hasData) {
			this.material.updateShaderCode(
				this.material.hasColorAttribute,
				true,
				this.material.hasTimeAttribute
			)
		}
		radiusStorage.updatePointsRadius(
			params.map((i) => i[1]),
			this._style.radius,
			this.total,
			params.map((i) => i[0])
		)
	}

	/**
	 * 设置模型的样式
	 * @param style
	 * @param pointIndices 可选，表示要更新的散点的索引，如果不传递，更新所有散点的样式
	 */
	setStyle(style: Exclude<IProps['style'], undefined>, pointIndices?: number[]) {
		if (!pointIndices) {
			this._style = deepMerge(this._style, style)
			this.updateMaterial()

			// 恢复为覆盖逻辑：如果已经存在 color attribute，全局更新时同步覆盖底层的 attribute 数据
			if (style.color && this.getAttribute('color')) {
				const colorArray = this._ensureColorAttribute()
				const colorArray32 = new Uint32Array(colorArray.buffer)
				const packedColor = packUint8ToUint32(style.color.map((c: number) => c * 255))
				colorArray32.fill(packedColor)
				this.updateAttribute('color', colorArray)
			}
		} else {
			if (style.color) {
				const colorArray = this._ensureColorAttribute()

				const r = (style.color[0] * 255) | 0
				const g = (style.color[1] * 255) | 0
				const b = (style.color[2] * 255) | 0
				const a = (style.color[3] * 255) | 0

				for (let i of pointIndices) {
					const offset = i * 4
					colorArray[offset + 0] = r
					colorArray[offset + 1] = g
					colorArray[offset + 2] = b
					colorArray[offset + 3] = a
				}
				this.updateAttribute('color', colorArray)
			}

			if (style.radius) {
				const radiusStorage = this.getRadiusStorage()
				if (!radiusStorage.hasData) {
					this.material.updateShaderCode(
						this.material.hasColorAttribute,
						true,
						this.material.hasTimeAttribute
					)
				}
				radiusStorage.updatePointsRadius(
					style.radius,
					this._style.radius,
					this.total,
					pointIndices
				)
			}
		}
	}

	getStyle(index?: number) {
		const style = { ...this._style }
		if (index === undefined) return style
		const colorArray = this.getAttribute('color')
		if (colorArray) {
			style.color = [
				colorArray[index * 4 + 0] / 255,
				colorArray[index * 4 + 1] / 255,
				colorArray[index * 4 + 2] / 255,
				colorArray[index * 4 + 3] / 255,
			]
		}
		const radiusStorage = this.getRadiusStorage()
		const radius = radiusStorage.getPointRadius(index)
		if (radius !== undefined) style.radius = radius
		return style
	}

	setTotal(count: number) {
		this._total = count
		this.reallocate()
	}

	private updateMaterial() {
		for (let k in this._style) {
			if (k === 'blending') {
				this.material.changeBlending(this._style[k])
			} else {
				this._material.updateUniform(k, this._style[k])
			}
		}
	}

	private initAttributes(props: IProps) {
		const positionAttribute = new Attribute('position', props.position, 2, {
			stepMode: 'instance',
			shaderLocation: 0,
			capacity: this.total * 2,
			usage: BufferType.VERTEX_STORAGE,
		})
		this.geometry.setAttribute('position', positionAttribute)

		if (props.color) {
			const colorAttribute = new Attribute('color', props.color, 4, {
				stepMode: 'instance',
				shaderLocation: 1,
				capacity: this.total * 4,
			})
			this.geometry.setAttribute('color', colorAttribute)
		}

		if (props.startTime) {
			const startTimeAttribute = new Attribute('startTime', props.startTime, 1, {
				stepMode: 'instance',
				shaderLocation: 2,
				capacity: this.total * 1,
			})
			this.geometry.setAttribute('startTime', startTimeAttribute)
		}

		this.geometry.vertexCount = 6 //wgsl 中通过硬编码设置了两个三角形的顶点坐标，由此组成一个正方形代表一个可以设置尺寸的散点
		this.geometry.instanceCount = props.position.length / 2
	}

	private reallocate() {
		console.log('reallocating')
		for (let attr of this.geometry.getAttributes()) {
			attr.reallocate(this.total * attr.itemSize)
		}
		this.getRadiusStorage().reallocate(this.total)
	}

	public appendPoints({
		position,
		startTime,
		color: colorData,
		radius: radiusData,
	}: Pick<IProps, 'position' | 'startTime' | 'color' | 'radius'>) {
		const appendLen = position.length / 2
		if (startTime && startTime.length !== appendLen) {
			throw 'startTime 数据不完备'
		}

		const currentLen = this.geometry.instanceCount
		if (appendLen + currentLen > this.total) {
			this._total = currentLen + appendLen * 5
			this.reallocate()
		}

		const positionAttr = this.geometry.getAttribute('position')
		if (positionAttr?.array) {
			positionAttr.array.set(position, currentLen * 2)
			positionAttr.needsUpdate = true
		}

		const colorAttr = this.geometry.getAttribute('color')
		if (colorAttr) {
			if (colorData) {
				colorAttr.array.set(colorData, currentLen * 4)
			} else {
				const color = packUint8ToUint32(this._style.color.map((c: number) => c * 255))
				const colorArray32 = new Uint32Array(colorAttr.array.buffer)
				colorArray32.fill(color, currentLen, appendLen + currentLen)
			}
			colorAttr.needsUpdate = true
		}

		const startTimeAttr = this.geometry.getAttribute('startTime')
		if (startTime && startTimeAttr?.array) {
			startTimeAttr.array.set(startTime, currentLen)
			startTimeAttr.needsUpdate = true
		}

		const radiusStorage = this.getRadiusStorage()
		let radiusArray8 = radiusData || new Uint8Array(appendLen).fill(this._style.radius)
		radiusStorage.appendData(radiusArray8, appendLen, currentLen)

		this.geometry.instanceCount += appendLen
	}

	public updateCurrentTime(time: number): void {
		this.material.updateUniform('currentTime', time)
	}

	public dispose() {
		super.dispose()
	}
}

export default Points
