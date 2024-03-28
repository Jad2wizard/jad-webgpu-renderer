import { makeShaderDataDefinitions } from 'webgpu-utils'
import Uniform from './uniform'

type Blending = 'normalBlending' | 'additiveBlending' | 'none'

type IProps = {
	shaderCode: string
	vertexShaderEntry?: string
	fragmentShaderEntry?: string
	uniforms?: Record<string, any>
	blending?: Blending
}

class Material {
	private vsEntry = 'vs'
	private fsEntry = 'fs'
	private code: string
	private uniforms: Record<string, { uniform: Uniform; version: number }>
	private blending: Blending
	private pipeline: GPURenderPipeline | null
	private shaderModule: GPUShaderModule | null

	constructor(props: IProps) {
		this.blending = props.blending || 'none'
		this.uniforms = {}
		this.code = props.shaderCode
		this.pipeline = null
		this.shaderModule = null
		if (props.vertexShaderEntry) this.vsEntry = props.vertexShaderEntry
		if (props.fragmentShaderEntry) this.fsEntry = props.fragmentShaderEntry
		if (props.uniforms) {
			this.initUniforms(props.uniforms)
		}
	}

	private initUniforms(uniforms: Record<string, any>) {
		const defs = makeShaderDataDefinitions(this.code)
		for (let un in defs.uniforms) {
			this.uniforms[un] = {
				version: -1,
				uniform: new Uniform({ name: un, def: defs.uniforms[un], value: uniforms[un] })
			}
		}
	}

	public getBindGroups(device: GPUDevice, pipeline: GPURenderPipeline) {
		const bindGroups: GPUBindGroup[] = []
		const groupIndexList = Array.from(new Set(Object.values(this.uniforms).map((u) => u.uniform.group)))
		for (let index of groupIndexList) {
			const descriptor: GPUBindGroupDescriptor = {
				layout: pipeline.getBindGroupLayout(index),
				entries: []
			}
			for (let un in this.uniforms) {
				const { uniform, version } = this.uniforms[un]
				if (version !== uniform.version) {
					uniform.updateBuffer(device)
					this.uniforms[un].version = uniform.version
				}
				const buffer = uniform.getBuffer(device)
				if (!buffer) continue
				const entries = descriptor.entries as GPUBindGroupEntry[]
				entries.push({
					binding: uniform.binding,
					resource: { buffer }
				})
			}
			const bindGroup = device.createBindGroup(descriptor)
			bindGroups.push(bindGroup)
		}
		return bindGroups
	}

	public getPipeline(device: GPUDevice, format: GPUTextureFormat, vertexBufferLayouts: GPUVertexBufferLayout[]) {
		if (!this.pipeline) this.createPipeline(device, format, vertexBufferLayouts)
		return this.pipeline
	}

	private createPipeline(device: GPUDevice, format: GPUTextureFormat, vertexBufferLayouts: GPUVertexBufferLayout[]) {
		if (!this.shaderModule) this.shaderModule = device.createShaderModule({ code: this.code })
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
				targets: [{ format }]
			}
		}
		this.configBlending(pipelineDescriptor)
		this.pipeline = device.createRenderPipeline(pipelineDescriptor)
	}

	private configBlending(pipelineDescriptor: GPURenderPipelineDescriptor) {
		switch (this.blending) {
			case 'normalBlending': {
				//@ts-ignore
				pipelineDescriptor.fragment.targets[0].blending = {
					color: {
						srcFactor: 'one',
						dstFactor: 'one-minus-src-alpha'
					},
					alpha: {
						srcFactor: 'one',
						dstFactor: 'one-minus-src-alpha'
					}
				}
				break
			}
			case 'additiveBlending': {
				//@ts-ignore
				pipelineDescriptor.fragment.targets[0].blending = {
					color: {
						srcFactor: 'one',
						dstFactor: 'one'
					},
					alpha: {
						srcFactor: 'one',
						dstFactor: 'one'
					}
				}
				break
			}
			default: {
				break
			}
		}
		return pipelineDescriptor
	}
}

export default Material
