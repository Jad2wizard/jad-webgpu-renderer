import Renderer from '../Renderer'

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

	abstract execute(
		renderer: Renderer,
		encoder: GPUCommandEncoder,
		resources: ResourceProvider
	): void
}

export abstract class RenderPass extends Pass {
	constructor(name: string) {
		super(name)
	}

	/**
	 * 创建通用渲染通道描述符
	 * @param label 标签
	 * @param texture 目标纹理
	 * @param clearColor 清除颜色
	 * @param loadOp 加载操作
	 * @param storeOp 存储操作
	 * @returns GPURenderPassDescriptor
	 */
	static createRenderPassDescriptor(
		label: string,
		texture: GPUTexture,
		clearColor: GPUColor = [0, 0, 0, 0],
		loadOp: GPULoadOp = 'clear',
		storeOp: GPUStoreOp = 'store'
	): GPURenderPassDescriptor {
		return {
			label,
			colorAttachments: [
				{
					view: texture.createView(),
					clearValue: clearColor,
					loadOp,
					storeOp,
				},
			],
		}
	}
}

export abstract class ComputePass extends Pass {
	constructor(name: string) {
		super(name)
	}
}
