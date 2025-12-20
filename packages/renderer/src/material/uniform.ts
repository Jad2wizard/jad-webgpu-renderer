/* eslint-disable no-undef */
import { makeStructuredView, StructuredView, VariableDefinition } from 'webgpu-utils'
import { Buffer, BufferType } from '@renderer/backend/Buffer'
import { WebGPUBackend } from '@renderer/backend'

export type IProps = {
	id: string
	name: string
	def: VariableDefinition
	value: any
}

class Uniform {
	protected _id: string
	protected _name: string
	protected def: VariableDefinition
	protected view: StructuredView
	protected _value: any
	protected _buffer: Buffer | null = null
	protected _needsUpdate = true

	constructor(props: IProps) {
		this._id = props.id
		this._name = props.name
		this.def = props.def
		this._value = props.value
		this.view = makeStructuredView(this.def)
		this.view.set(props.value)
		// Buffer 将在 updateBuffer 时创建
	}

	get id() {
		return this._id
	}

	get name() {
		return this._name
	}

	get value() {
		return this._value
	}

	get binding() {
		return this.def.binding
	}

	get group() {
		return this.def.group
	}

	get size() {
		return this.view.arrayBuffer.byteLength
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

	public updateValue(value: any) {
		this.view.set(value)
		this._value = value
		this.needsUpdate = true
	}

	public updateBuffer(backend: WebGPUBackend) {
		if (this.needsUpdate && this.view.arrayBuffer) {
			if (!this._buffer) {
				// 创建新的 buffer
				this._buffer = backend.createBuffer({
					label: this.id,
					type: BufferType.UNIFORM,
					resourceName: this._name,
					size: this.view.arrayBuffer.byteLength,
					initialData: this.view.arrayBuffer,
				})
			} else {
				// 更新现有 buffer
				backend.updateBuffer(this._buffer, this.view.arrayBuffer)
			}
			this.needsUpdate = false
			return true
		}
		return false
	}

	dispose() {
		if (this._buffer) {
			// Buffer 的销毁由 BufferManager 统一管理
			this._buffer = null
		}
		this._value = undefined
	}
}

export default Uniform
