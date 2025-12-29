import Geometry from '../geometry/geometry'
import Attribute from '../geometry/attribute'
import { Buffer, BufferType } from '../backend/Buffer'
import PointMaterial from './pointMaterial'
import { computeShader } from '../material/shaders/pointsCompute'
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
	private pickUniform: Uniform | undefined
	private pickResultStorage: Storage | undefined
	private pickBindGroup: GPUBindGroup | undefined
	private pickPipeline: GPUComputePipeline | undefined

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
				loadOp === 'clear' ? renderer.webgpuBackend.getClearColor() : undefined
			),
		]
	}

	private getRadiusStorage() {
		return this.material.getStorage('radius') as RadiusStorage
	}

	batchUpdateColor(params: [number, Color][]) {
		let colorArray = this.getAttribute('color')
		if (!colorArray) {
			const colorArray32 = new Uint32Array(this.total) //使用 Uint32Array 代替 Uint8Array，达到 TypedArray 快速填充的目的
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
		for (let item of params) {
			const [i, color] = item
			colorArray[i * 4 + 0] = color[0] * 255
			colorArray[i * 4 + 1] = color[1] * 255
			colorArray[i * 4 + 2] = color[2] * 255
			colorArray[i * 4 + 3] = color[3] * 255
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
		} else {
			if (style.color) {
				let colorArray = this.getAttribute('color')
				if (!colorArray) {
					const colorArray32 = new Uint32Array(this.total) //使用 Uint32Array 代替 Uint8Array，达到 TypedArray 快速填充的目的
					const packedColor = packUint8ToUint32(
						this._style.color.map((c: number) => c * 255)
					)
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
				for (let i of pointIndices) {
					colorArray[i * 4 + 0] = style.color[0] * 255
					colorArray[i * 4 + 1] = style.color[1] * 255
					colorArray[i * 4 + 2] = style.color[2] * 255
					colorArray[i * 4 + 3] = style.color[3] * 255
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
		this.pickBindGroup = undefined
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

	public async pick(
		renderer: Renderer,
		x: number,
		y: number,
		radius: number = 5
	): Promise<number[]> {
		const device = renderer.device
		const backend = renderer.webgpuBackend

		// 1. Create Buffers if not exist
		if (!this.pickUniform || !this.pickResultStorage) {
			const defs = makeShaderDataDefinitions(computeShader)

			if (!this.pickUniform) {
				this.pickUniform = new Uniform({
					id: 'pick-uniform',
					name: 'params',
					def: defs.uniforms['params'],
					value: {
						targetPos: [x, y],
						radiusSq: radius * radius,
						total: this.total,
					},
				})
			}

			if (!this.pickResultStorage) {
				this.pickResultStorage = new Storage({
					id: 'pick-result',
					name: 'result',
					def: defs.storages['result'],
					value: {
						count: 0,
						indices: new Uint32Array(1024),
					},
				})
				this.pickResultStorage.usage = BufferType.READ_WRITE_STORAGE
			}
		}

		// 2. Update Uniforms
		this.pickUniform.updateValue({
			targetPos: [x, y],
			radiusSq: radius * radius,
			total: this.total,
		})
		this.pickUniform.updateBuffer(backend)

		// 3. Reset Result Count
		// Use structured update
		this.pickResultStorage.updateValue({
			count: 0,
			indices: new Uint32Array(1024), // Resetting indices as well, though not strictly necessary if we only read based on count
		})
		this.pickResultStorage.updateBuffer(backend)

		// 4. Get Pipeline
		if (!this.pickPipeline) {
			this.pickPipeline = backend.getPipelineManager().getOrCreateComputePipeline({
				id: 'points-picking',
				version: 1,
				options: {
					label: 'points-picking-pipeline',
					shaderCode: computeShader,
					entryPoint: 'main',
				},
			})
		}

		// 5. Create BindGroup if needed
		const positionAttr = this.geometry.getAttribute('position')
		if (!positionAttr) return []

		// Ensure position buffer is created
		positionAttr.updateBuffer(backend)
		const positionBuffer = positionAttr.buffer

		if (!positionBuffer || !positionBuffer.GPUBuffer) return []

		if (!this.pickBindGroup) {
			// Ensure result buffer is created
			this.pickResultStorage.updateBuffer(backend)
			const resultGPUBuffer = this.pickResultStorage.buffer?.GPUBuffer
			const uniformGPUBuffer = this.pickUniform.buffer?.GPUBuffer

			if (!resultGPUBuffer || !uniformGPUBuffer) return []

			this.pickBindGroup = device.createBindGroup({
				layout: this.pickPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: { buffer: positionBuffer.GPUBuffer } },
					{ binding: 1, resource: { buffer: uniformGPUBuffer } },
					{ binding: 2, resource: { buffer: resultGPUBuffer } },
				],
			})
		}

		// 6. Dispatch
		const commandEncoder = device.createCommandEncoder()
		const pass = commandEncoder.beginComputePass()
		pass.setPipeline(this.pickPipeline)
		pass.setBindGroup(0, this.pickBindGroup)
		pass.dispatchWorkgroups(Math.ceil(this.total / 64))
		pass.end()

		// 7. Read Back
		const resultSize = 4 + 1024 * 4
		const readBuffer = device.createBuffer({
			size: resultSize,
			usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
		})

		const resultGPUBuffer = this.pickResultStorage.buffer?.GPUBuffer
		if (!resultGPUBuffer) return []

		commandEncoder.copyBufferToBuffer(resultGPUBuffer, 0, readBuffer, 0, resultSize)
		device.queue.submit([commandEncoder.finish()])

		await readBuffer.mapAsync(GPUMapMode.READ)
		const resultData = new Uint32Array(readBuffer.getMappedRange())
		const count = resultData[0]
		const indices: number[] = []
		for (let i = 0; i < Math.min(count, 1024); i++) {
			indices.push(resultData[i + 1])
		}
		readBuffer.unmap()
		readBuffer.destroy()

		return indices
	}
}

export default Points
