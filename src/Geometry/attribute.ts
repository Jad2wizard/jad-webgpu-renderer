/* eslint-disable no-undef */
import {TypedArray} from 'localType'

class Attribute {
	private _array: TypedArray
	private _itemSize: number
	private _version = 0
	private _buffer: GPUBuffer | null

	constructor(data: TypedArray, itemSize: number) {
		this._array = data
		this._itemSize = itemSize
		this._buffer = null
	}

	public needsUpdate() {
		this._version++
	}

	public updateBuffer(device: GPUDevice, name: string) {
		if (this._buffer) {
			this._buffer.destroy()
		}
		this._buffer = device.createBuffer({
			label: name + ' vertex buffer',
			size: this._array.byteLength,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
		})
		device.queue.writeBuffer(this._buffer, 0, this._array)
	}

	get version() {
		return this._version
	}

	get array() {
		return this._array
	}

	set array(data: TypedArray) {
		this._array = data
		this._version++
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

	public getFormat() {
		return this._array.constructor.name.split('Array')[0].toLocaleLowerCase() as GPUVertexFormat
	}

	public dispose() {
		if (this._buffer) {
			this._buffer.destroy()
		}
	}
}

export default Attribute
