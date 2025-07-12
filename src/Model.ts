import { Camera } from './camera/camera'
import Renderer from './Renderer'
import Geometry from './geometry/geometry'
import Material from './material/material'
import { IRenderable, TypedArray } from '@/types'
import { indexFormat } from './utils'
import { WebGPUBackend } from '@/backend'

type Options = {}

class Model implements IRenderable {
	protected _id: string
	protected _geometry: Geometry
	protected _material: Material
	protected _visible: boolean
	protected _renderOrder: number
	protected _style: any = {}
	protected textures: Record<string, GPUTexture> = {}

	constructor(name: string, geometry: Geometry, material: Material, opts?: Options) {
		this._id = name
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

	public prevRender(renderer: Renderer, encoder: GPUCommandEncoder, camera: Camera): void {
		// 预渲染逻辑，如果需要的话
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
	): void {
		if (!this.visible) return
		const backend = renderer.webgpuBackend as WebGPUBackend
		const { material, geometry } = this
		const pipeline = material.getPipeline(renderer, geometry.getVertexBufferLayout())
		const { bindGroups, groupIndexList } = material.getBindGroups(
			renderer,
			camera,
			backend,
			textures || this.textures,
			geometry.getVertexBufferLayout()
		)

		// 设置管线
		if (pipeline) {
			pass.setPipeline(pipeline)
		}
		for (let i = 0; i < groupIndexList.length; i++) {
			pass.setBindGroup(groupIndexList[i], bindGroups[i])
		}

		// 更新并设置顶点缓冲区
		const vertexBuffers = geometry.updateVertexBuffers(backend)
		for (let i = 0; i < vertexBuffers.length; i++) {
			const buffer = vertexBuffers[i]
			pass.setVertexBuffer(i, buffer.GPUBuffer!)
		}
		const instanceCount = geometry.instanceCount > -1 ? geometry.instanceCount : undefined
		const indexBuffer = geometry.getIndexBuffer(backend)
		if (indexBuffer && geometry.index) {
			pass.setIndexBuffer(indexBuffer.GPUBuffer!, indexFormat as GPUIndexFormat)
			pass.drawIndexed(geometry.index.array.length, instanceCount)
		} else {
			pass.draw(geometry.vertexCount, instanceCount)
		}
	}

	public dispose() {
		this._geometry.dispose()
		this._material.dispose()
		for (let tid in this.textures) {
			this.textures[tid].destroy()
		}
		this.textures = {}
	}
}

export default Model
