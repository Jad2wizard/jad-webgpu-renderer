import { ShaderDataDefinitions, makeShaderDataDefinitions } from 'webgpu-utils'
import { Blending } from '../types'
import Renderer from '../Renderer'
import { TypedArray } from '../types'
import { Camera } from '@/camera/camera'
import Uniform from './uniform'
import Storage from './storage'
import { WebGPUBuffer } from '@/backend/WebGPUBuffer'
import { WebGPUBackend } from '@/backend'

type IProps = {
	id: string
	renderCode: string
	vertexShaderEntry?: string
	fragmentShaderEntry?: string
	uniforms?: Record<string, any>
	storages?: Record<string, TypedArray | undefined | Storage>
	blending?: Blending
	presentationFormat?: GPUTextureFormat
	renderBindGroupLayoutDescriptors?: GPUBindGroupLayoutDescriptor[]
	multisampleCount?: number
	primitive?: GPUPrimitiveState
}

class Material {
	private id: string
	private pipeline: GPURenderPipeline | null = null
	private _vsEntry: string
	private _fsEntry: string
	protected code: string
	protected uniforms: Record<string, Uniform> = {}
	protected storages: Record<string, Storage> = {}
	protected _blending: Blending = 'none'
	protected shaderModule: GPUShaderModule | null = null
	protected _defs: ShaderDataDefinitions
	protected textureInfos: Record<string, { group: number; binding: number }> = {}
	private bindGroupLayoutDescriptors?: GPUBindGroupLayoutDescriptor[]
	private presentationFormat?: GPUTextureFormat
	private multisampleCount?: number
	private _primitive?: GPUPrimitiveState

	constructor(props: IProps) {
		this.id = props.id
		this.code = props.renderCode
		this._vsEntry = props.vertexShaderEntry || 'vs'
		this._fsEntry = props.fragmentShaderEntry || 'fs'
		this.bindGroupLayoutDescriptors = props.renderBindGroupLayoutDescriptors
		this.presentationFormat = props.presentationFormat
		if (props.blending) this._blending = props.blending
		this._defs = this.parseShaderCode(props)
		this.multisampleCount = props.multisampleCount
		this._primitive = props.primitive
	}

	get blending() {
		return this._blending
	}

	get primitive() {
		return this._primitive
	}

	get vsEntry() {
		return this._vsEntry
	}

	get fsEntry() {
		return this._fsEntry
	}

	public changeBlending(b: Blending | undefined) {
		this._blending = b || 'none'
		this.pipeline = null
	}

	public changeShaderCode(renderCode: string) {
		this.code = renderCode
		this.shaderModule = null
		this.pipeline = null
	}

	public changePrimitive(p?: GPUPrimitiveState) {
		this._primitive = p
		this.pipeline = null
	}

	public changeVsEntry(entry: string) {
		this._vsEntry = entry
		this.pipeline = null
	}

	public changeFsEntry(entry: string) {
		this._fsEntry = entry
		this.pipeline = null
	}

	protected parseShaderCode(props: IProps) {
		const defs = makeShaderDataDefinitions(this.code)
		const { uniforms = {}, storages = {} } = props
		for (let un in defs.uniforms) {
			this.uniforms[un] = new Uniform({
				name: un,
				def: defs.uniforms[un],
				value: uniforms[un],
			})
		}
		for (let sn in defs.storages) {
			const storage = storages[sn]
			if (storage instanceof Storage) {
				storage.def = defs.storages[sn]
				this.storages[sn] = storage
			} else {
				this.storages[sn] = new Storage({
					name: sn,
					def: defs.storages[sn],
					value: storage,
				})
			}
		}
		for (let tn in defs.textures) {
			this.textureInfos[tn] = { group: defs.textures[tn].group, binding: defs.textures[tn].binding }
		}
		return defs
	}

	public getUniform(name: string): Uniform | null {
		const uniform = this.uniforms[name]
		return uniform || null
	}

	public getUniforms() {
		return this.uniforms
	}

	public getStorage(name: string): Storage | null {
		const storage = this.storages[name]
		return storage || null
	}

	public getStorages() {
		return this.storages
	}

	public updateUniform(uniformName: string, value: any) {
		const uniform = this.uniforms[uniformName]
		if (!uniform) return
		uniform.updateValue(value)
	}

	public updateStorage(storageName: string, value: TypedArray) {
		const storage = this.storages[storageName]
		if (!storage) return
		storage.updateValue(value)
	}

	public getBuffers(backend: WebGPUBackend): WebGPUBuffer[] {
		const res: WebGPUBuffer[] = []
		for (let un in this.uniforms) {
			if (['projectionMatrix', 'viewMatrix', 'resolution'].includes(un)) continue
			this.uniforms[un].updateBuffer(backend)
			if (this.uniforms[un].buffer && !res.find((b) => b.id === this.uniforms[un].buffer!.id)) {
				res.push(this.uniforms[un].buffer!)
			}
		}
		for (let sn in this.storages) {
			this.storages[sn].updateBuffer(backend)
			if (this.storages[sn].buffer && !res.find((b) => b.id === this.storages[sn].buffer!.id)) {
				res.push(this.storages[sn].buffer!)
			}
		}
		return res
	}

	public getPipeline(renderer: Renderer, vertexBufferLayouts: GPUVertexBufferLayout[]) {
		if (!this.pipeline) this.createPipeline(renderer, vertexBufferLayouts)
		return this.pipeline
	}

	private createPipeline(renderer: Renderer, vertexBufferLayouts: GPUVertexBufferLayout[]) {
		const { device, presentationFormat } = renderer
		if (!this.shaderModule) this.shaderModule = device.createShaderModule({ code: this.code })
		const pipelineDescriptor: GPURenderPipelineDescriptor = {
			label: 'pipeline-' + this.id,
			layout: this.bindGroupLayoutDescriptors
				? device.createPipelineLayout({
						bindGroupLayouts: this.bindGroupLayoutDescriptors.map((d) => device.createBindGroupLayout(d)),
					})
				: 'auto',
			vertex: {
				module: this.shaderModule,
				entryPoint: this.vsEntry,
				buffers: vertexBufferLayouts,
			},
			fragment: {
				module: this.shaderModule,
				entryPoint: this.fsEntry,
				targets: [{ format: this.presentationFormat || presentationFormat }],
			},
		}
		if (this.primitive) {
			pipelineDescriptor.primitive = this.primitive
		}
		switch (this.blending) {
			case 'normalBlending': {
				//@ts-ignore
				pipelineDescriptor.fragment.targets[0].blend = {
					color: {
						srcFactor: 'one',
						dstFactor: 'one-minus-src-alpha',
					},
					alpha: {
						srcFactor: 'one',
						dstFactor: 'one-minus-src-alpha',
					},
				}
				break
			}
			case 'additiveBlending': {
				//@ts-ignore
				pipelineDescriptor.fragment.targets[0].blend = {
					color: {
						srcFactor: 'one',
						dstFactor: 'one',
					},
					alpha: {
						srcFactor: 'one',
						dstFactor: 'one',
					},
				}
				break
			}
			case 'max':
			case 'min': {
				//@ts-ignore
				pipelineDescriptor.fragment.targets[0].blend = {
					color: {
						srcFactor: 'one',
						dstFactor: 'one',
						operation: this.blending,
					},
					alpha: {
						srcFactor: 'one',
						dstFactor: 'one',
						operation: this.blending,
					},
				}
			}
			default: {
				break
			}
		}
		if (this.multisampleCount) pipelineDescriptor.multisample = { count: this.multisampleCount }
		else if (renderer.antialias) pipelineDescriptor.multisample = { count: 4 }
		this.pipeline = device.createRenderPipeline(pipelineDescriptor)
	}

	public getBindGroups(
		renderer: Renderer,
		camera: Camera,
		backend: WebGPUBackend,
		textures: Record<string, GPUTexture>
	): { bindGroups: GPUBindGroup[]; groupIndexList: number[] } {
		if (!this.pipeline) return { bindGroups: [], groupIndexList: [] }

		const { device } = renderer
		const bindGroups: GPUBindGroup[] = []
		const uniformGroupIndexs = Object.values(this.uniforms).map((u) => u.group)
		const storageGroupIndexs = Object.values(this.storages).map((u) => u.group)

		const groupIndexList = Array.from(new Set([...uniformGroupIndexs, ...storageGroupIndexs]))
		for (let index of groupIndexList) {
			const descriptor: GPUBindGroupDescriptor = {
				layout: this.pipeline.getBindGroupLayout(index),
				entries: [],
			}
			const entries = descriptor.entries as GPUBindGroupEntry[]
			for (let un in this.uniforms) {
				const uniform = this.uniforms[un]
				if (uniform.group !== index) continue
				let buffer: GPUBuffer | null = null
				if (uniform.name === 'projectionMatrix') {
				buffer = camera.getProjectionMatBuf(device)
				entries.push({
					binding: uniform.binding,
					resource: { buffer, offset: 0, size: uniform.size },
				})
			} else if (uniform.name === 'viewMatrix') {
				buffer = camera.getViewMatBuf(device)
				entries.push({
					binding: uniform.binding,
					resource: { buffer, offset: 0, size: uniform.size },
				})
			} else if (uniform.name === 'resolution') {
				buffer = renderer.resolutionBuf
				entries.push({
					binding: uniform.binding,
					resource: { buffer, offset: 0, size: uniform.size },
				})
			} else {
				if (uniform.needsUpdate) uniform.updateBuffer(backend)
				buffer = uniform.buffer?.GPUBuffer || null
				if (buffer) {
					entries.push({
						binding: uniform.binding,
						resource: { buffer, offset: 0, size: uniform.size },
					})
				}
			}
			}
			for (let sn in this.storages) {
			const storage = this.storages[sn]
			if (storage.group !== index) continue
			if (storage.needsUpdate) storage.updateBuffer(backend)
			const buffer = storage.buffer?.GPUBuffer
			if (buffer) {
				entries.push({
					binding: storage.binding,
					resource: { buffer, offset: 0, size: storage.size },
				})
			}
		}
			for (let tn in this.textureInfos) {
				const { group, binding } = this.textureInfos[tn]
				if (group !== index) continue
				const texture = textures[tn]
				if (!texture) continue
				entries.push({ binding, resource: texture.createView() })
			}
			const bindGroup = device.createBindGroup(descriptor)
			bindGroups.push(bindGroup)
		}
		return { bindGroups, groupIndexList }
	}

	public dispose() {
		for (let un in this.uniforms) {
			this.uniforms[un].dispose()
		}
		for (let sn in this.storages) {
			this.storages[sn].dispose()
		}
	}
}

export default Material
