import { Camera } from './camera/camera'
import BufferPool from './buffer/bufferPool'
import Renderer from './Renderer'
import Geometry from './geometry/geometry'
import Material from './material/material'
import { IRenderable, TypedArray } from '@/types'
import { genId, indexFormat } from './utils'

type Options = {}

class Model implements IRenderable {
	protected _id: string
	protected _geometry: Geometry
	protected _material: Material
	protected _visible: boolean
	protected _renderOrder: number
	protected _bufferPool = new BufferPool()
	protected _style: any = {}
	protected textures: Record<string, GPUTexture> = {}

	constructor(geometry: Geometry, material: Material, opts?: Options) {
		this._id = 'model_' + genId()
		this._geometry = geometry
		this._material = material
		this._visible = true
		this._renderOrder = 0
	}

	get id() {
		return this._id
	}

	set id(v: string) {
		this._id = v
	}

	get geometry() {
		return this._geometry
	}

	set geometry(geo: Geometry) {
		this._geometry = geo
	}

	get material() {
		return this._material
	}

	set material(mat: Material) {
		this._material = mat
	}

	get bufferPool() {
		return this._bufferPool
	}

	set bufferPool(bp: BufferPool) {
		if (this._bufferPool) this._bufferPool.dispose()
		this._bufferPool = bp
	}

	get visible() {
		return this._visible
	}

	set visible(v: boolean) {
		this._visible = v
	}

	get renderOrder() {
		return this._renderOrder
	}

	set renderOrder(r: number) {
		this._renderOrder = r
	}

	public updateTexture(tn: string, texture: GPUTexture) {
		if (this.textures[tn]) this.textures[tn].destroy()
		this.textures[tn] = texture
	}

	public prevRender(renderer: Renderer, encoder: GPUCommandEncoder, camera: Camera) {}

	private initBufferPool(device: GPUDevice) {
		const { material, geometry } = this
		this.bufferPool.createBuffers(device, [...material.getBufferViews(), ...geometry.getBufferViews()])
	}

	public getAttribute(k: string) {
		const attr = this._geometry.getAttribute(k)
		if (attr) return attr.array
		return null
	}

	public updateAttribute(k: string, value: TypedArray) {
		const attr = this._geometry.getAttribute(k)
		if (attr) {
			attr.array = value
		}
	}

	public render(
		renderer: Renderer,
		pass: GPURenderPassEncoder,
		camera: Camera,
		textures?: Record<string, GPUTexture>
	) {
		const { geometry, material } = this
		const { device } = renderer
		if (!this.bufferPool.initialed) this.initBufferPool(device)
		const vertexBufferLayouts = geometry.getVertexBufferLayout()
		const vertexBufferViewList = geometry.updateVertexBufferViewList(device, this.bufferPool)

		const pipeline = material.getPipeline(renderer, vertexBufferLayouts)
		if (!pipeline) return
		const { bindGroups, groupIndexList } = material.getBindGroups(
			renderer,
			camera,
			this.bufferPool,
			textures || this.textures
		)
		pass.setPipeline(pipeline)
		for (let i = 0; i < bindGroups.length; ++i) {
			pass.setBindGroup(groupIndexList[i], bindGroups[i])
		}
		for (let i = 0; i < vertexBufferViewList.length; ++i) {
			const bv = vertexBufferViewList[i]
			pass.setVertexBuffer(i, bv.GPUBuffer, bv.offset, bv.size)
		}
		const indexBufferView = geometry.getIndexBufferView(device, this._bufferPool)
		if (indexBufferView?.GPUBuffer) {
			pass.setIndexBuffer(indexBufferView.GPUBuffer, indexFormat, indexBufferView.offset, indexBufferView.size)
		}
		const instanceCount = geometry.instanceCount > -1 ? geometry.instanceCount : undefined
		const index = geometry.getIndex()
		if (index) pass.drawIndexed(index.length, instanceCount)
		else pass.draw(geometry.vertexCount, instanceCount)
	}

	public dispose() {
		this._geometry.dispose()
		this._material.dispose()
		this.bufferPool.dispose()
		for (let tid in this.textures) {
			this.textures[tid].destroy()
		}
		this.textures = {}
	}
}

export default Model
