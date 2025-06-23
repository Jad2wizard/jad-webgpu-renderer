/* eslint-disable no-undef */
import { genId } from '@/utils'
import { TypedArray } from '@/types'
import { WebGPUBuffer, BufferType } from '@/backend/WebGPUBuffer'
import { WebGPUBackend } from '@/backend'

type Options = {
	shaderLocation?: number
	stepMode?: GPUVertexStepMode
	capacity?: number
}

class Attribute {
	private _name: string
	private _array: TypedArray
	private _itemSize: number
	private _buffer: WebGPUBuffer | null = null
	private _shaderLocation?: number
	private _stepMode: GPUVertexStepMode = 'vertex'
	private _needsUpdate = true

	constructor(name: string, data: TypedArray, itemSize: number, options?: Options) {
		this._name = name
		this._array = data
		this._itemSize = itemSize
		this._shaderLocation = options?.shaderLocation
		if (options?.stepMode) this._stepMode = options.stepMode
		// Buffer 将在 updateBuffer 时创建
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

	get shaderLocation() {
		return this._shaderLocation
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
		if (this.needsUpdate && this._array) {
			if (!this._buffer) {
				// 创建新的 buffer
				this._buffer = backend.createBuffer({
					type: BufferType.VERTEX,
					resourceName: 'attribute_' + this._name,
					size: this._array.byteLength,
					initialData: this._array.buffer
				})
			} else {
				// 更新现有 buffer
				backend.updateBuffer(this._buffer, this._array.buffer)
			}
			this.needsUpdate = false
			return true
		}
		return false
	}

	public getFormat() {
		let typeStr = this._array.constructor.name.split('Array')[0].toLocaleLowerCase() //Float32, Uint8, Int8, ...
		if (typeStr.startsWith('int')) typeStr = 's' + typeStr
		// if (typeStr.includes('int')) typeStr = typeStr.replace('int', 'norm')
		return (typeStr.toLocaleLowerCase() + (this.itemSize === 1 ? '' : `x${this.itemSize}`)) as GPUVertexFormat
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
			// Buffer 的销毁由 BufferManager 统一管理
			this._buffer = null
		}
	}
}

export default Attribute
