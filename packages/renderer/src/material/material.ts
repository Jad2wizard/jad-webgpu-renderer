import { ShaderDataDefinitions, makeShaderDataDefinitions } from 'webgpu-utils'
import { Blending } from '../types'
import Renderer from '../Renderer'
import { TypedArray } from '../types'
import { Camera } from '@renderer/camera/camera'
import Uniform from './uniform'
import Storage from './storage'
import { Buffer } from '@renderer/backend/Buffer'
import { WebGPUBackend } from '@renderer/backend'
import { WebGPUPipelineOptions, PipelineRequest } from '@renderer/backend/WebGPUPipeline'

type IProps = {
	id: string
	renderCode: string
	vertexShaderEntry?: string
	fragmentShaderEntry?: string
	uniforms?: Record<string, any>
	storages?: Record<string, any>
	blending?: Blending
	presentationFormat?: GPUTextureFormat
	renderBindGroupLayoutDescriptors?: GPUBindGroupLayoutDescriptor[]
	multisampleCount?: number
	primitive?: GPUPrimitiveState
}

class Material {
	private id: string
	private pipelineVersion: number = 0
	private _vsEntry: string
	private _fsEntry: string
	protected code: string
	protected uniforms: Record<string, Uniform> = {}
	protected storages: Record<string, Storage> = {}
	protected _blending: Blending = 'none'

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
		this._defs = this.parseShaderCodeAndInitResource(props)
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
		this.invalidatePipeline()
	}

	public changeShaderCode(renderCode: string) {
		this.code = renderCode
		this.invalidatePipeline()
	}

	public changePrimitive(p?: GPUPrimitiveState) {
		this._primitive = p
		this.invalidatePipeline()
	}

	public changeVsEntry(entry: string) {
		this._vsEntry = entry
		this.invalidatePipeline()
	}

	public changeFsEntry(entry: string) {
		this._fsEntry = entry
		this.invalidatePipeline()
	}

	private invalidatePipeline(): void {
		this.pipelineVersion++
	}

	protected parseShaderCodeAndInitResource(props: IProps) {
		const defs = makeShaderDataDefinitions(this.code)
		const { uniforms = {}, storages = {} } = props
		for (let un in defs.uniforms) {
			this.uniforms[un] = new Uniform({
				name: un,
				def: defs.uniforms[un],
				value: uniforms[un],
				id: this.id + '-' + un + '-uniform',
			})
		}
		for (let sn in defs.storages) {
			const storage = storages[sn]
			if (storage instanceof Storage) {
				this.storages[sn] = storage.shallowClone(this.id + '-' + sn + '-storage', sn)
				this.storages[sn].def = defs.storages[sn]
			} else {
				this.storages[sn] = new Storage({
					name: sn,
					def: defs.storages[sn],
					value: storage,
					id: this.id + '-' + sn + '-storage',
				})
			}
		}
		for (let tn in defs.textures) {
			this.textureInfos[tn] = {
				group: defs.textures[tn].group,
				binding: defs.textures[tn].binding,
			}
		}
		return defs
	}

	public getUniform(name: string): Uniform | undefined {
		return this.uniforms[name]
	}

	public getStorage(name: string): Storage | undefined {
		return this.storages[name]
	}

	public getUniforms() {
		return this.uniforms
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

	public getBuffers(backend: WebGPUBackend): Buffer[] {
		const res: Buffer[] = []
		for (let un in this.uniforms) {
			if (['projectionMatrix', 'viewMatrix', 'resolution'].includes(un)) continue
			this.uniforms[un].updateBuffer(backend)
			if (
				this.uniforms[un].buffer &&
				!res.find((b) => b.id === this.uniforms[un].buffer!.id)
			) {
				res.push(this.uniforms[un].buffer!)
			}
		}
		for (let sn in this.storages) {
			this.storages[sn].updateBuffer(backend)
			if (
				this.storages[sn].buffer &&
				!res.find((b) => b.id === this.storages[sn].buffer!.id)
			) {
				res.push(this.storages[sn].buffer!)
			}
		}
		return res
	}

	public getPipeline(
		renderer: Renderer,
		vertexBufferLayouts: GPUVertexBufferLayout[]
	): GPURenderPipeline {
		const pipelineManager = renderer.webgpuBackend.getPipelineManager()

		const pipelineOptions: WebGPUPipelineOptions = {
			label: this.id,
			shaderCode: this.code,
			vertexEntry: this.vsEntry,
			fragmentEntry: this.fsEntry,
			vertexBufferLayouts,
			presentationFormat: this.presentationFormat,
			blending: this.blending,
			primitive: this.primitive,
			multisampleCount: this.multisampleCount,
			bindGroupLayoutDescriptors: this.bindGroupLayoutDescriptors,
		}

		const request: PipelineRequest = {
			id: this.id,
			version: this.pipelineVersion,
			options: pipelineOptions,
		}

		return pipelineManager.getOrCreatePipeline(request, renderer)
	}

	/**
	 * 创建并返回WebGPU绑定组
	 * 该方法负责将材质中的uniform、storage和纹理资源绑定到GPU管线中
	 * @param renderer 渲染器实例，提供GPU设备和分辨率缓冲区
	 * @param camera 相机实例，提供投影矩阵和视图矩阵缓冲区
	 * @param backend WebGPU后端实例，用于更新缓冲区
	 * @param textures 纹理资源映射表，键为纹理名称，值为GPU纹理对象
	 * @returns 包含绑定组数组和组索引列表的对象
	 */
	public getBindGroups(
		renderer: Renderer,
		camera: Camera,
		backend: WebGPUBackend,
		textures: Record<string, GPUTexture>,
		vertexBufferLayouts: GPUVertexBufferLayout[]
	): { bindGroups: GPUBindGroup[]; groupIndexList: number[] } {
		// 动态获取管线
		const pipeline = this.getPipeline(renderer, vertexBufferLayouts)

		// 使用 WebGPUBindGroupManager 创建材质绑定组
		const bindGroupManager = backend.getBindGroupManager()
		return bindGroupManager.createMaterialBindGroups(
			this.id,
			pipeline,
			this.uniforms,
			this.storages,
			this.textureInfos,
			renderer,
			camera,
			backend,
			textures
		)
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
