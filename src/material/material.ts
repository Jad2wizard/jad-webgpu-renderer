import {makeShaderDataDefinitions} from 'webgpu-utils'
import Uniform from './uniform'

type Blending = 'normalBlending' | 'additiveBlending' | 'none'

type IProps = {
	shaderCode: string
	vertexShaderEntry: string
	fragmentShaderEntry: string
	textureFormat: GPUTextureFormat
	uniforms?: Record<string, any>
	blending?: Blending
}

class Material {
	private vsEntry: string
	private fsEntry: string
	private code: string
	private uniforms: Record<string, {uniform: Uniform; version: number}>
	private blending: Blending
	private pipeline: GPURenderPipeline | null
	private shaderModule: GPUShaderModule | null
	private format: GPUTextureFormat

	constructor(props: IProps) {
		this.vsEntry = props.vertexShaderEntry
		this.fsEntry = props.fragmentShaderEntry
		this.blending = props.blending || 'none'
		this.format = props.textureFormat
		this.uniforms = {}
		this.code = props.shaderCode
		this.pipeline = null
		this.shaderModule = null
		if (props.uniforms) {
			this.initUniforms(props.uniforms)
		}
	}

	private initUniforms(uniforms: Record<string, any>) {
		const defs = makeShaderDataDefinitions(this.code)
		for (let un in defs.uniforms) {
			this.uniforms[un] = {
				version: -1,
				uniform: new Uniform({name: un, def: defs.uniforms[un], value: uniforms[un]})
			}
		}
	}

	public getBindGroups(device: GPUDevice, pipeline: GPURenderPipeline) {
		const bindGroups: GPUBindGroup[] = []
		const groupIndexList = Array.from(new Set(Object.values(this.uniforms).map(u => u.uniform.group)))
		for (let index of groupIndexList) {
			const descriptor: GPUBindGroupDescriptor = {
				layout: pipeline.getBindGroupLayout(index),
				entries: []
			}
			for (let un in this.uniforms) {
				const {uniform, version} = this.uniforms[un]
				if (version !== uniform.version) {
					uniform.updateBuffer(device)
					this.uniforms[un].version = uniform.version
				}
				const buffer = uniform.getBuffer(device)
				if (!buffer) continue
				const entries = descriptor.entries as GPUBindGroupEntry[]
				entries.push({
					binding: uniform.binding,
					resource: {buffer}
				})
			}
			const bindGroup = device.createBindGroup(descriptor)
			bindGroups.push(bindGroup)
		}
		return bindGroups
	}

	public getPipeline(device: GPUDevice, vertexBufferLayouts: GPUVertexBufferLayout[]) {
		if (!this.pipeline) this.createPipeline(device, vertexBufferLayouts)
		return this.pipeline
	}

	private createPipeline(device: GPUDevice, vertexBufferLayouts: GPUVertexBufferLayout[]) {
		if (!this.shaderModule) this.shaderModule = device.createShaderModule({code: this.code})
		const pipelineDescriptor: GPURenderPipelineDescriptor = {
			label: 'pipeline',
			layout: 'auto',
			vertex: {
				module: this.shaderModule,
				entryPoint: this.vsEntry,
				buffers: vertexBufferLayouts
			},
			fragment: {
				module: this.shaderModule,
				entryPoint: this.fsEntry,
				targets: [{format: this.format}]
			}
		}
		this.pipeline = device.createRenderPipeline(pipelineDescriptor)
	}
}

export default Material
