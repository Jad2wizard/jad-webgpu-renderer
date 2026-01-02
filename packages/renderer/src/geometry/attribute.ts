/* eslint-disable no-undef */
import { TypedArray } from '@renderer/types'
import { Buffer, BufferType } from '@renderer/backend/Buffer'
import { WebGPUBackend } from '@renderer/backend'

type Options = {
	shaderLocation?: number
	stepMode?: GPUVertexStepMode
	capacity?: number
	usage?: BufferType
}

class Attribute {
	private _name: string
	private _array: TypedArray
	private _itemSize: number
	private _capacity: number
	private _buffer: Buffer | null = null
	private _shaderLocation?: number
	private _stepMode: GPUVertexStepMode = 'vertex'
	private _usage: BufferType = BufferType.VERTEX
	private _needsUpdate = true

	constructor(name: string, data: TypedArray, itemSize: number, options?: Options) {
		this._name = name
		this._array = data
		this._itemSize = itemSize
		this._shaderLocation = options?.shaderLocation
		if (options?.stepMode) this._stepMode = options.stepMode
		if (options?.usage) this._usage = options.usage
		if (options?.capacity) this._capacity = options.capacity
	}

	get needsUpdate() {
		return this._needsUpdate
	}

	set needsUpdate(v: boolean) {
		this._needsUpdate = v
	}

	get name() {
		return this._name
	}

	set name(v: string) {
		this._name = v
	}

	get shaderLocation() {
		return this._shaderLocation
	}

	get capacity() {
		return this._capacity
	}

	set shaderLocation(l: number | undefined) {
		this._shaderLocation = l
	}

	get stepMode() {
		return this._stepMode
	}

	get array() {
		return this._array
	}

	set array(data: TypedArray) {
		this._array = data
		this.needsUpdate = true
	}

	get itemSize() {
		return this._itemSize
	}

	set itemSize(v: number) {
		this._itemSize = Math.floor(v)
	}

	get buffer() {
		return this._buffer
	}

	public updateBuffer(backend: WebGPUBackend) {
		if (this.needsUpdate && this.array) {
			if (this.capacity) {
				// 容量大于0，使用容量计算 bufferSize
				const bufferSize = this._capacity * this._itemSize * this._array.BYTES_PER_ELEMENT
				//如果 bufferSize 大于当前数组长度，需要重新创建数组
				if (bufferSize > this.array.byteLength) {
					//@ts-ignore
					const newArray = new this._array.constructor(this._capacity * this._itemSize)
					newArray.set(this.array)
					this._array = newArray
				}
			}
			if (!this._buffer) {
				// 创建新的 buffer
				const resourceName = 'attrubite_' + this._name
				this._buffer = backend.createBuffer({
					label: resourceName,
					type: this._usage,
					resourceName,
					size: this._array.byteLength,
					initialData: this._array.buffer as ArrayBuffer,
				})
			} else {
				// 更新现有 buffer
				backend.updateBuffer(this._buffer, this._array.buffer as ArrayBuffer)
			}
			this.needsUpdate = false
			return true
		}
		return false
	}

	public getFormat(): GPUVertexFormat {
		// 验证数组是否存在
		if (!this._array) {
			throw new Error(`Attribute '${this._name}': array is null or undefined`)
		}

		// 验证 itemSize 的有效性
		if (!Number.isInteger(this._itemSize) || this._itemSize < 1 || this._itemSize > 4) {
			throw new Error(
				`Attribute '${this._name}': itemSize must be an integer between 1 and 4, got ${this._itemSize}`
			)
		}

		// 获取类型字符串
		const constructorName = this._array.constructor.name
		if (!constructorName || !constructorName.endsWith('Array')) {
			throw new Error(`Attribute '${this._name}': invalid array type '${constructorName}'`)
		}

		// 提取基础类型名称
		let baseType = constructorName.replace('Array', '').toLowerCase()

		// 处理不同的数据类型
		let typePrefix: string
		switch (baseType) {
			case 'float32':
				typePrefix = 'float32'
				break
			case 'float64':
				// WebGPU 不支持 float64，抛出错误
				throw new Error(`Attribute '${this._name}': float64 is not supported in WebGPU`)
			case 'uint8':
				typePrefix = 'uint8'
				break
			case 'uint16':
				typePrefix = 'uint16'
				break
			case 'uint32':
				typePrefix = 'uint32'
				break
			case 'int8':
				typePrefix = 'sint8'
				break
			case 'int16':
				typePrefix = 'sint16'
				break
			case 'int32':
				typePrefix = 'sint32'
				break
			default:
				throw new Error(`Attribute '${this._name}': unsupported array type '${baseType}'`)
		}

		// 构建格式字符串
		const formatStr = this._itemSize === 1 ? typePrefix : `${typePrefix}x${this._itemSize}`

		// 验证生成的格式是否为有效的 GPUVertexFormat
		const validFormats: GPUVertexFormat[] = [
			'uint8x2',
			'uint8x4',
			'sint8x2',
			'sint8x4',
			'unorm8x2',
			'unorm8x4',
			'snorm8x2',
			'snorm8x4',
			'uint16x2',
			'uint16x4',
			'sint16x2',
			'sint16x4',
			'unorm16x2',
			'unorm16x4',
			'snorm16x2',
			'snorm16x4',
			'float16x2',
			'float16x4',
			'float32',
			'float32x2',
			'float32x3',
			'float32x4',
			'uint32',
			'uint32x2',
			'uint32x3',
			'uint32x4',
			'sint32',
			'sint32x2',
			'sint32x3',
			'sint32x4',
		]

		if (!validFormats.includes(formatStr as GPUVertexFormat)) {
			throw new Error(
				`Attribute '${this._name}': generated format '${formatStr}' is not a valid GPUVertexFormat`
			)
		}

		return formatStr as GPUVertexFormat
	}

	public reallocate(size: number) {
		//@ts-ignore
		const newArray = new this._array.constructor(size) as typeof this._array
		newArray.set(this._array.subarray(0, size))
		this._array = newArray
		this.needsUpdate = true
	}

	public dispose() {
		//@ts-ignore
		this._array = undefined
		if (this._buffer) {
			this._buffer.dispose()
			this._buffer = null
		}
	}
}

export default Attribute
