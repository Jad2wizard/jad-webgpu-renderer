import Renderer from '../Renderer'
import { WebGPUBackend } from '../backend'

export type ResourceHandle = string

export interface ResourceProvider {
	getResource(handle: ResourceHandle): GPUTexture | GPUBuffer | undefined
	addResource(handle: ResourceHandle, resource: GPUTexture | GPUBuffer): void
}

export abstract class Pass {
	public name: string
	public inputs: Set<ResourceHandle> = new Set()
	public outputs: Set<ResourceHandle> = new Set()

	constructor(name: string) {
		this.name = name
	}

	read(handle: ResourceHandle): void {
		this.inputs.add(handle)
	}

	write(handle: ResourceHandle): void {
		this.outputs.add(handle)
	}

	abstract execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void
}

export abstract class RenderPass extends Pass {
	constructor(name: string) {
		super(name)
	}
}

export abstract class ComputePass extends Pass {
	constructor(name: string) {
		super(name)
	}
}
