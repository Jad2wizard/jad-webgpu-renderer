import { Camera } from './camera/camera'
import Renderer from './Renderer'
import Geometry from './geometry/geometry'
import Material from './material/material'
import { IRenderable, TypedArray } from '@renderer/types'
import { WebGPUBackend } from '@renderer/backend'

import { Pass } from './pass/Pass'

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

	set id(s: string) {
		this._id = s
	}

	get geometry() {
		return this._geometry
	}

	get material() {
		return this._material
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

	public getPasses(renderer: Renderer, camera: Camera, loadOp?: GPULoadOp): Pass[] {
		return []
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
		backend.drawModel(this, renderer, pass, camera, textures || this.textures)
	}

	public dispose() {
		this._geometry.dispose()
		this._material.dispose()
		for (const key in this.textures) {
			const texture = this.textures[key]
			texture.destroy()
		}
		this.textures = {}
	}
}

export default Model
