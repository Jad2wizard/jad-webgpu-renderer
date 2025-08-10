import { TypedArray } from '@/types'
import { WebGPUBuffer, BufferType } from '@/backend/WebGPUBuffer'
import { WebGPUBackend } from '@/backend'

class Index {
	private _name: string
	private _array: TypedArray
	private _buffer: WebGPUBuffer | null = null
	private _needsUpdate = true

	constructor(name: string, data: TypedArray) {
		this._name = name
		this._array = data
		// Buffer 将在 updateBuffer 时创建
	}

	get name() {
		return this._name
	}

	get needsUpdate() {
		return this._needsUpdate
	}

	set needsUpdate(v: boolean) {
		this._needsUpdate = v
	}

	get array() {
		return this._array
	}

	set array(value: TypedArray) {
		this._array = value
		this.needsUpdate = true
	}

	get buffer() {
		return this._buffer
	}

	public updateBuffer(backend: WebGPUBackend) {
		if (this.needsUpdate && this._array) {
			if (!this._buffer) {
				// 创建新的 buffer
				this._buffer = backend.createBuffer({
					label: this._name,
					type: BufferType.INDEX,
					resourceName: 'index',
					size: this._array.byteLength,
					initialData: this._array.buffer,
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

	public dispose() {
		//@ts-ignore
		this._array = undefined
		if (this._buffer) {
			// Buffer 的销毁由 BufferManager 统一管理
			this._buffer = null
		}
	}
}

export default Index
