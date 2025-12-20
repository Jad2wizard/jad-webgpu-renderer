import Renderer from '../Renderer'
import { Pass, ResourceHandle, ResourceProvider } from './Pass'

export class RenderGraph implements ResourceProvider {
	private passes: Pass[] = []
	private resources: Map<ResourceHandle, GPUTexture | GPUBuffer> = new Map()
	private renderer: Renderer

	constructor(renderer: Renderer) {
		this.renderer = renderer
	}

	addPass(pass: Pass) {
		this.passes.push(pass)
	}

	getResource(handle: ResourceHandle): GPUTexture | GPUBuffer | undefined {
		return this.resources.get(handle)
	}

	addResource(handle: ResourceHandle, resource: GPUTexture | GPUBuffer): void {
		this.resources.set(handle, resource)
	}

	hasResource(handle: ResourceHandle): boolean {
		return this.resources.has(handle)
	}

	execute(encoder: GPUCommandEncoder) {
		// 目前仅按添加顺序依次执行
		for (const pass of this.passes) {
			pass.execute(this.renderer, encoder, this)
		}
	}

	clear() {
		this.passes = []
	}

	dispose() {
		this.passes = []
		// 资源生命周期由外部（如 Heatmap 类）管理，RenderGraph 仅持有引用
		this.resources.clear()
	}
}
