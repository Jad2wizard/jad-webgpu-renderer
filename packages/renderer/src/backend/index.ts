import { Buffer, BufferType } from './Buffer'
import { BufferManager } from './WebGPUBuffer'
import { WebGPUPipelineManager } from './WebGPUPipeline'
import type { WebGPUPipelineOptions } from './WebGPUPipeline'
import { WebGPUBindGroupManager } from './WebGPUBindGroup'
import type { BindGroupEntryConfig, SystemUniformType } from './WebGPUBindGroup'
import { WebGPUTextureFactory } from './WebGPUTextureFactory'

// 导出 Pipeline 相关类和接口
export { WebGPUPipelineManager }
export type { WebGPUPipelineOptions }

// 导出 BindGroup 相关类和接口
export { WebGPUBindGroupManager }
export type { BindGroupEntryConfig, SystemUniformType }

// 导出 Texture 相关类
export { WebGPUTextureFactory }

export class WebGPUBackend {
	private device: GPUDevice
	private bufferManager: BufferManager // 添加 BufferManager 实例
	private pipelineManager: WebGPUPipelineManager // 添加 PipelineManager 实例
	private bindGroupManager: WebGPUBindGroupManager // 添加 BindGroupManager 实例
	private textureFactory: WebGPUTextureFactory // 添加 TextureFactory 实例

	constructor(device: GPUDevice) {
		this.device = device
		// 初始化 BufferManager
		this.bufferManager = new BufferManager(device)
		// 初始化 PipelineManager
		this.pipelineManager = new WebGPUPipelineManager(device)
		// 初始化 BindGroupManager
		this.bindGroupManager = new WebGPUBindGroupManager(device)
		// 初始化 TextureFactory
		this.textureFactory = new WebGPUTextureFactory(device)
	}

	/**
	 * 获取 PipelineManager 实例
	 */
	getPipelineManager(): WebGPUPipelineManager {
		return this.pipelineManager
	}

	/**
	 * 获取 BindGroupManager 实例
	 * @returns BindGroupManager 实例
	 */
	getBindGroupManager(): WebGPUBindGroupManager {
		return this.bindGroupManager
	}

	/**
	 * 获取 TextureFactory 实例
	 * @returns TextureFactory 实例
	 */
	getTextureFactory(): WebGPUTextureFactory {
		return this.textureFactory
	}

	/**
	 * 统一的 Buffer 创建函数（替换所有类型特定的创建方法）
	 * @param options 创建选项
	 * @returns WebGPUBuffer实例
	 */
	createBuffer(options: {
		type: BufferType
		resourceName: string
		size: number
		initialData?: ArrayBuffer | ArrayBufferView
		label: string
	}): Buffer {
		if (!this.bufferManager) {
			throw new Error('BufferManager not initialized. Call init() first.')
		}
		return this.bufferManager.createBuffer(options.type, {
			resourceName: options.resourceName,
			size: options.size,
			initialData: options.initialData,
			label: options.label,
		})
	}

	/**
	 * 更新Buffer数据
	 * @param buffer 要更新的Buffer
	 * @param data 新数据
	 * @param offset 偏移量，默认为0
	 */
	updateBuffer(buffer: Buffer, data: ArrayBuffer | ArrayBufferView, offset: number = 0): void {
		if (!this.bufferManager) {
			throw new Error('BufferManager not initialized. Call init() first.')
		}
		this.bufferManager.updateBuffer(buffer, data, offset)
	}
}
