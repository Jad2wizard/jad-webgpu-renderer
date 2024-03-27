/* eslint-disable no-undef */
import {TypedArray} from '@/types'
import {makeStructuredView, StructuredView, VariableDefinition} from 'webgpu-utils'

type IProps = {
	name: string
	def: VariableDefinition
	value: any
}

class Uniform {
	private _version = 0
	private _name: string
	private def: VariableDefinition
	private view: StructuredView
	private buffer: GPUBuffer | null

	constructor(props: IProps) {
		this._name = props.name
		this.def = props.def
		this.view = makeStructuredView(this.def)
		this.view.set(props.value)
		this.buffer = null
	}

	get version() {
		return this._version
	}

	get name() {
		return this._name
	}

	get binding() {
		return this.def.binding
	}

	get group() {
		return this.def.group
	}

	get byteLength() {
		return this.view.arrayBuffer.byteLength
	}

	get arrayBuffer() {
		return this.view.arrayBuffer
	}

	public needsUpdate() {
		this._version++
	}

	public getBuffer(device: GPUDevice) {
		if (!this.buffer) this.createBuffer(device)
		return this.buffer
	}

	public dispose() {
		if (this.buffer) this.buffer.destroy()
	}

	public updateBuffer(device: GPUDevice) {
		if (!this.buffer) this.createBuffer(device)
		if (!this.buffer) return
		device.queue.writeBuffer(this.buffer, 0, this.arrayBuffer)
	}

	private createBuffer(device: GPUDevice) {
		if (this.buffer) this.buffer.destroy()
		this.buffer = device.createBuffer({
			size: this.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		})
	}
}

export default Uniform
