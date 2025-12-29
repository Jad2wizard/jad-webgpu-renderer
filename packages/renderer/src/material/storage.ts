/* eslint-disable no-undef */
import { TypedArray } from '@renderer/types'
import { Buffer, BufferType } from '@renderer/backend/Buffer'
import { WebGPUBackend } from '@renderer/backend'
import { makeStructuredView, StructuredView, VariableDefinition } from 'webgpu-utils'

export type IProps = {
	id: string
	name: string
	def?: VariableDefinition
	value?: TypedArray | any
	buffer?: Buffer
	byteLength?: number
}

/**
 * shader中 storage 变量是动态数组，没有确定的长度，所以webgpu-utils 无法为 storage 创建 typedArray，
 * 需要我们自己设置typedArray。而且 storage buffer的大小是可变的
 */
class Storage {
	protected _id: string
	protected _name: string
	protected _value: any
	protected _buffer: Buffer | null = null
	protected _needsUpdate = true
	protected _def?: VariableDefinition
	protected _usage: BufferType = BufferType.STORAGE
	public view?: StructuredView

	constructor(props: IProps) {
		this._id = props.id
		this._name = props.name
		this._def = props.def
		this._buffer = props.buffer || null

		// Determine mode: Raw TypedArray or Structured
		// If value is explicitly a TypedArray, use Raw mode (backward compatibility and simple arrays)
		if (props.value && ArrayBuffer.isView(props.value)) {
			this._value = props.value
		} else if (this._def) {
			// Try to use StructuredView if def is present and value is not a TypedArray
			try {
				this.view = makeStructuredView(this._def)
				if (props.value) {
					this.view.set(props.value)
				}
				this._value = props.value
			} catch (e) {
				console.warn(`Failed to create structured view for storage ${this._name}`, e)
				this._value = props.value || new Float32Array()
			}
		} else {
			this._value = props.value || new Float32Array()
		}
	}

	set usage(usage: BufferType) {
		this._usage = usage
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

	get def() {
		return this._def
	}

	set def(v: VariableDefinition | undefined) {
		this._def = v
		// If we receive a def and don't have a view or raw value yet, we might want to initialize view?
		// But usually def is set after construction in Material.
		// If we are in Raw mode (existing _value is TypedArray), we likely stay in Raw mode.
		if (v && !this.view && (!this._value || !ArrayBuffer.isView(this._value))) {
			try {
				this.view = makeStructuredView(v)
				if (this._value) {
					this.view.set(this._value)
				}
			} catch (e) {
				// ignore
			}
		}
	}

	get binding() {
		return this.def?.binding || 0
	}

	get group() {
		return this.def?.group || 0
	}

	get size() {
		if (this.view) {
			return this.view.arrayBuffer.byteLength
		}
		return (this._value as TypedArray).byteLength
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
		if (this.view) {
			this.view.set(value)
			this._value = value
			this.needsUpdate = true
		} else {
			this._value = value
			this.needsUpdate = true
		}
	}

	public updateBuffer(backend: WebGPUBackend) {
		const data = this.view
			? this.view.arrayBuffer
			: ((this._value as TypedArray)?.buffer as ArrayBuffer)
		const size = this.view
			? this.view.arrayBuffer.byteLength
			: (this._value as TypedArray)?.byteLength

		if (!data || size === undefined) return false

		if (this.needsUpdate) {
			if (!this._buffer || this._buffer.size !== size) {
				// 创建新的 buffer
				this._buffer = backend.createBuffer({
					label: this._id,
					type: this._usage,
					resourceName: this._name,
					size: size,
					initialData: data,
				})
			} else {
				// 更新现有 buffer
				backend.updateBuffer(this._buffer, data)
			}
			this.needsUpdate = false
			return true
		} else if (this._buffer) {
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

	/**
	 * 克隆当前 Storage 实例
	 * @param id 新实例的 id，如果不提供则使用原实例的 id
	 * @param name 新实例的 name，如果不提供则使用原实例的 name
	 * @param def 新实例的 def，如果不提供则使用原实例的 def
	 * @returns 新的 Storage 实例
	 */
	public shallowClone(id: string, name: string, def?: VariableDefinition): Storage {
		// Attempt to preserve the subclass type if possible, but constructor signatures might differ.
		// For safety and backward compatibility with current Material implementation, we return new Storage.
		// Ideally this should use this.constructor and match props.
		return new Storage({
			id: id || this._id,
			name: name || this._name,
			def: def || this._def,
			value: this.value,
			buffer: this.buffer || undefined,
		})
	}
}

export default Storage
