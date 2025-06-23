import { genId } from '@/utils'
import { TypedArray } from '@/types'
import { WebGPUBuffer, BufferType } from '@/backend/WebGPUBuffer'
import { WebGPUBackend } from '@/backend'
import { VariableDefinition } from 'webgpu-utils'

export type IProps = {
	name: string
	def?: VariableDefinition
	value?: TypedArray
	byteLength?: number
}

/**
 * shader中 storage 变量是动态数组，没有确定的长度，所以webgpu-utils 无法为 storage 创建 typedArray，
 * 需要我们自己设置typedArray。而且 storage buffer的大小是可变的
 */
class Storage {
	protected _name: string
	protected _value: TypedArray
	protected _buffer: WebGPUBuffer | null = null
	protected _needsUpdate = true
	protected _def?: VariableDefinition

	constructor(props: IProps) {
		this._name = props.name
		this._value = props.value || new Float32Array()
		this._def = props.def
		// Buffer 将在 updateBuffer 时创建
	}

	get name() {
		return this._name
	}

	get value() {
		return this._value
	}

	get def() {
		return this._def
	}

	set def(v: VariableDefinition | undefined) {
		this._def = v
	}

	get binding() {
		return this.def?.binding || 0
	}

	get group() {
		return this.def?.group || 0
	}

	get size() {
		return this._value.byteLength
	}

	get buffer() {
		return this._buffer
	}

	get needsUpdate() {
		return this._needsUpdate
	}

	set needsUpdate(v: boolean) {
		this._needsUpdate = v
	}

	public updateValue(value: TypedArray) {
		this._value = value
		this.needsUpdate = true
	}

	public updateBuffer(backend: WebGPUBackend) {
		if (this.needsUpdate && this._value) {
			if (!this._buffer) {
				// 创建新的 buffer
				this._buffer = backend.createBuffer({
					type: BufferType.STORAGE,
					resourceName: this._name,
					size: this._value.byteLength,
					initialData: this._value.buffer,
				})
			} else {
				// 更新现有 buffer
				backend.updateBuffer(this._buffer, this._value.buffer)
			}
			this.needsUpdate = false
			return true
		}
		return false
	}

	public dispose() {
		if (this._buffer) {
			// Buffer 的销毁由 BufferManager 统一管理
			this._buffer = null
		}
	}
}

export default Storage
