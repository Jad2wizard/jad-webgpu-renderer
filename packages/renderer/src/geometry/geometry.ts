import Attribute from './attribute'
import Index from './indices'
import { Group } from '@renderer/types'
import { WebGPUBuffer } from '@renderer/backend/WebGPUBuffer'
import { WebGPUBackend } from '@renderer/backend'

class Geometry {
	private _id: string
	private _group?: Group
	private attributes: Record<string, Attribute>
	private _vertexCount = -1
	private _instanceCount = -1
	public index: Index | null = null

	constructor(id: string) {
		this._id = id
		this.attributes = {}
	}

	get id() {
		return this._id
	}

	set group(value: Group | undefined) {
		this._group = value
	}

	get group() {
		return this._group
	}

	set vertexCount(v: number) {
		this._vertexCount = v
	}

	get vertexCount() {
		return this._vertexCount
	}

	set instanceCount(i: number) {
		this._instanceCount = i
	}

	get instanceCount() {
		return this._instanceCount
	}

	public getAttribute(name: string) {
		if (this.attributes[name]) {
			return this.attributes[name]
		}
		return null
	}

	public setAttribute(attribtueName: string, attribute: Attribute) {
		if (attribute.shaderLocation === undefined) {
			let location = 0
			const existedLocations = Object.values(this.attributes)
				.map((attr) => attr.shaderLocation)
				.filter((l) => l !== undefined)
			while (existedLocations.includes(location)) location++
			attribute.shaderLocation = location
		}
		attribute.name = this.id + '-' + attribtueName
		this.attributes[attribtueName] = attribute
		// const count = attribute.array.length / attribute.itemSize
		// if (attribute.stepMode === 'vertex' && this._vertexCount === -1) this._vertexCount = count
		// if (attribute.stepMode === 'instance' && this._instanceCount === -1) this._instanceCount = count
	}

	public removeAttribute(attribtueName: string) {
		const attr = this.attributes[attribtueName]
		if (attr) {
			attr.dispose()
			delete this.attributes[attribtueName]
		}
	}

	public setIndex(arr: Uint32Array | undefined) {
		if (!arr) {
			if (this.index) {
				this.index.dispose()
				this.index = null
			}
		} else {
			if (!this.index) this.index = new Index(this.id + '-index', arr)
			else this.index.array = arr
		}
	}

	public getIndex() {
		return this.index?.array || null
	}

	public getIndexBuffer(backend: WebGPUBackend): WebGPUBuffer | null {
		if (!this.index) return null
		this.index.updateBuffer(backend)
		return this.index.buffer
	}

	public getVertexBufferLayout() {
		const vertexBufferLayouts: GPUVertexBufferLayout[] = []
		for (let attribute of Object.values(this.attributes)) {
			const { itemSize, array, shaderLocation, stepMode } = attribute
			const bufferLayout: GPUVertexBufferLayout = {
				arrayStride: itemSize * array.BYTES_PER_ELEMENT,
				stepMode,
				attributes: [
					{
						shaderLocation: shaderLocation || 0,
						offset: 0,
						format: attribute.getFormat(),
					},
				],
			}
			vertexBufferLayouts.push(bufferLayout)
		}
		return vertexBufferLayouts
	}

	public getAttributes() {
		return Object.values(this.attributes)
	}

	public getBuffers(backend: WebGPUBackend): WebGPUBuffer[] {
		const res: WebGPUBuffer[] = []
		// 更新所有 attribute buffers
		for (let an in this.attributes) {
			this.attributes[an].updateBuffer(backend)
			if (this.attributes[an].buffer) {
				res.push(this.attributes[an].buffer!)
			}
		}
		// 更新 index buffer
		if (this.index) {
			this.index.updateBuffer(backend)
			if (this.index.buffer) {
				res.push(this.index.buffer)
			}
		}
		return res
	}

	public updateVertexBuffers(backend: WebGPUBackend): WebGPUBuffer[] {
		const buffers: WebGPUBuffer[] = []
		for (let an in this.attributes) {
			const attribute = this.attributes[an]
			attribute.updateBuffer(backend)
			if (attribute.buffer?.GPUBuffer) {
				buffers.push(attribute.buffer)
			}
		}
		return buffers
	}

	public dispose() {
		for (let name in this.attributes) {
			this.attributes[name].dispose()
		}
		this.attributes = {}
	}
}

export default Geometry
