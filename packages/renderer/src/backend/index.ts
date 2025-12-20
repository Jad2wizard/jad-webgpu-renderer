import { Color } from '@renderer/types'
import Scene from '../Scene'
import type Model from '../Model'
import { Camera } from '../camera/camera'
import { WebGPUUtils } from './WebGPUUtils'
import { normalizeColor, indexFormat } from '@renderer/utils'
import Renderer from '@renderer/Renderer'
import { Buffer, BufferType, BufferOptions } from './Buffer'
import { BufferManager, CreateBufferOptions } from './WebGPUBuffer'
import { WebGPUPipelineManager } from './WebGPUPipeline'
import type { WebGPUPipelineOptions } from './WebGPUPipeline'
import { WebGPUBindGroupManager } from './WebGPUBindGroup'
import type { BindGroupEntryConfig, SystemUniformType } from './WebGPUBindGroup'
import { WebGPUTextureFactory } from './WebGPUTextureFactory'
import { WebGPURenderPassManager } from './WebGPURenderPassManager'

// 导出 Pipeline 相关类和接口
export { WebGPUPipelineManager }
export type { WebGPUPipelineOptions }

// 导出 BindGroup 相关类和接口
export { WebGPUBindGroupManager }
export type { BindGroupEntryConfig, SystemUniformType }

// 导出 Texture 相关类
export { WebGPUTextureFactory }

// 导出 RenderPass 相关类
export { WebGPURenderPassManager }

export class WebGPUBackend {
	private device: GPUDevice
	private context: GPUCanvasContext
	private format: GPUTextureFormat
	private canvas: HTMLCanvasElement
	private renderPassDescriptor: GPURenderPassDescriptor
	private clearColor: Color = [0, 0, 0, 0] as Color
	private antialias: boolean
	private deviceLimits?: GPUDeviceDescriptor['requiredLimits']
	private multisampleTexture: GPUTexture | null
	private resolutionBuf: GPUBuffer
	private bufferManager: BufferManager // 添加 BufferManager 实例
	private pipelineManager: WebGPUPipelineManager // 添加 PipelineManager 实例
	private bindGroupManager: WebGPUBindGroupManager // 添加 BindGroupManager 实例
	private textureFactory: WebGPUTextureFactory // 添加 TextureFactory 实例
	private renderPassManager: WebGPURenderPassManager // 添加 RenderPassManager 实例

	constructor(
		canvas: HTMLCanvasElement,
		options?: {
			clearColor?: [number, number, number, number]
			antialias?: boolean
			deviceLimits?: GPUDeviceDescriptor['requiredLimits']
		}
	) {
		this.canvas = canvas
		options?.antialias !== undefined && (this.antialias = options.antialias)
		options?.clearColor !== undefined && (this.clearColor = normalizeColor(options.clearColor))
		this.deviceLimits = options?.deviceLimits
	}

	getAntialias() {
		return this.antialias
	}

	setAntialias(v: boolean) {
		this.antialias = v
	}

	getWidth() {
		return this.canvas.width
	}

	getHeight() {
		return this.canvas.height
	}

	getDevice() {
		return this.device
	}

	getPresentationFormat() {
		return this.format
	}

	getRenderPassDescriptor(renderTarget?: GPUTexture) {
		this.updateRenderPassDescriptor(renderTarget)
		this.updateResolution()
		return this.renderPassDescriptor
	}

	async init() {
		try {
			//使用 webgpuutils 初始化 device
			const { device, context, format } = await WebGPUUtils.initWebGPU(this.canvas, {
				antiAlias: this.antialias,
				deviceLimits: this.deviceLimits,
			})

			this.device = device
			this.context = context
			this.format = format

			// 初始化 BufferManager
			this.bufferManager = new BufferManager(device)

			// 初始化 PipelineManager
			this.pipelineManager = new WebGPUPipelineManager(device)

			// 初始化 BindGroupManager
			this.bindGroupManager = new WebGPUBindGroupManager(device)

			// 初始化 TextureFactory
			this.textureFactory = new WebGPUTextureFactory(device)

			// 初始化 RenderPassManager
			this.renderPassManager = new WebGPURenderPassManager(device)

			this.context.configure({
				device,
				format,
				alphaMode: 'premultiplied', // 确保透明度正确处理，输出到 canvas 上的颜色在 fragment shader中已经预乘过 alpha 值。浏览器合成器在混合 canvas 与网页背景时就不会再对 alpha 进行处理。
			})
			this.renderPassDescriptor = {
				label: 'render pass',
				colorAttachments: [
					{
						view: context.getCurrentTexture().createView(),
						clearValue: this.clearColor,
						loadOp: 'clear',
						storeOp: 'store',
					},
				],
			}
			this.resolutionBuf = device.createBuffer({
				size: 2 * 4,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				label: 'resolution buffer',
			})
			if (this.antialias) this.createMultisampleTexture()
			this.resize()
			this.device.lost.then((info) => {
				console.error('WebGPU device lost', info.message)
			})
		} catch (e) {
			throw e
		}
	}

	getResolutionBuffer() {
		return this.resolutionBuf
	}

	/**
	 * 根据camera获取projectionMatrix和viewMatrix，遍历scene.children。
	 * 从children[i]中获取到geometry和material。从geometry中获取顶点数据，从material中获取渲染管线（包含着色器）
	 * 每个模型设置一次renderPass，最后统一提交到GPU
	 * @param camera
	 * @param scene
	 */
	public drawModel(
		model: Model,
		renderer: Renderer,
		pass: GPURenderPassEncoder,
		camera: Camera,
		textures: Record<string, GPUTexture>
	): void {
		const { material, geometry } = model
		const vertexBufferLayouts = geometry.getVertexBufferLayout()
		const pipeline = material.getPipeline(renderer, vertexBufferLayouts)
		const { bindGroups, groupIndexList } = material.getBindGroups(
			renderer,
			camera,
			this,
			textures,
			vertexBufferLayouts
		)

		if (pipeline) pass.setPipeline(pipeline)
		for (let i = 0; i < groupIndexList.length; i++) {
			pass.setBindGroup(groupIndexList[i], bindGroups[i])
		}

		const vertexBuffers = geometry.updateVertexBuffers(this)
		for (let i = 0; i < vertexBuffers.length; i++) {
			const buffer = vertexBuffers[i]
			pass.setVertexBuffer(i, buffer.GPUBuffer!)
		}

		const instanceCount = geometry.instanceCount > -1 ? geometry.instanceCount : undefined
		const indexBuffer = geometry.getIndexBuffer(this)
		if (indexBuffer && geometry.index) {
			pass.setIndexBuffer(indexBuffer.GPUBuffer!, indexFormat as GPUIndexFormat)
			pass.drawIndexed(geometry.index.array.length, instanceCount)
		} else {
			pass.draw(geometry.vertexCount, instanceCount)
		}
	}

	resize() {
		this.canvas.width = this.canvas.offsetWidth
		this.canvas.height = this.canvas.offsetHeight
		this.updateResolution()
		// 重新创建多重采样纹理以匹配新的 canvas 尺寸
		if (this.antialias && this.multisampleTexture) {
			this.createMultisampleTexture()
		}
	}

	private createMultisampleTexture() {
		if (this.multisampleTexture) this.multisampleTexture.destroy()
		const outputCanvavTexture = this.context.getCurrentTexture()
		this.multisampleTexture = this.device.createTexture({
			format: outputCanvavTexture.format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
			size: [outputCanvavTexture.width, outputCanvavTexture.height],
			sampleCount: 4, //MSAA webgpu只支持采样率为1或者4的重采样
		})
	}

	private updateRenderPassDescriptor(renderTarget?: GPUTexture) {
		const colorAttachment = (
			this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[]
		)[0]
		if (!renderTarget) {
			if (!this.antialias) {
				colorAttachment.view = this.context.getCurrentTexture().createView()
				colorAttachment.resolveTarget = undefined
			} else {
				if (!this.multisampleTexture) this.createMultisampleTexture()
				if (!this.multisampleTexture) return
				colorAttachment.view = this.multisampleTexture.createView()
				colorAttachment.resolveTarget = this.context.getCurrentTexture().createView()
			}
		} else {
			colorAttachment.view = renderTarget.createView()
			colorAttachment.resolveTarget = undefined
		}
	}

	private updateResolution() {
		const resolution = new Float32Array([this.canvas.width, this.canvas.height])
		this.device.queue.writeBuffer(this.resolutionBuf, 0, resolution)
	}

	/**
	 * 获取 BufferManager 实例
	 */
	getBufferManager(): BufferManager {
		return this.bufferManager
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

	getMultisampleTexture(): GPUTexture | null {
		return this.multisampleTexture
	}

	getClearColor(): Color {
		return this.clearColor
	}

	updateGlobalUniforms(camera: Camera) {
		camera.updateMatrixBuffers(this.device)
		this.updateResolution()
	}

	/**
	 * 获取 RenderPassManager 实例
	 * @returns RenderPassManager 实例
	 */
	getRenderPassManager(): WebGPURenderPassManager {
		return this.renderPassManager
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
	 * 根据ID获取Buffer
	 * @param id Buffer的ID
	 * @returns Buffer实例或undefined
	 */
	getBuffer(id: string): Buffer | undefined {
		if (!this.bufferManager) {
			return undefined
		}
		return this.bufferManager.getBuffer(id)
	}

	/**
	 * 根据资源名称获取Buffer列表
	 * @param resourceName 资源名称
	 * @returns Buffer数组
	 */
	getBuffersByResourceName(resourceName: string): Buffer[] {
		if (!this.bufferManager) {
			return []
		}
		return this.bufferManager.getBuffersByResourceName(resourceName)
	}

	/**
	 * 根据类型获取Buffer列表
	 * @param type Buffer类型
	 * @returns Buffer数组
	 */
	getBuffersByType(type: BufferType): Buffer[] {
		if (!this.bufferManager) {
			return []
		}
		return this.bufferManager.getBuffersByType(type)
	}

	/**
	 * 获取所有Buffer
	 * @returns Buffer映射表
	 */
	getAllBuffers(): Map<string, Buffer> {
		if (!this.bufferManager) {
			return new Map()
		}
		return this.bufferManager.getAllBuffers()
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

	/**
	 * 销毁指定的Buffer
	 * @param buffer 要销毁的Buffer
	 * @returns 是否成功销毁
	 */
	destroyBuffer(buffer: Buffer): boolean {
		if (!this.bufferManager) {
			return false
		}
		return this.bufferManager.destroyBuffer(buffer)
	}

	/**
	 * 根据ID销毁Buffer
	 * @param id Buffer的ID
	 * @returns 是否成功销毁
	 */
	destroyBufferById(id: string): boolean {
		if (!this.bufferManager) {
			return false
		}
		return this.bufferManager.destroyBufferById(id)
	}

	/**
	 * 销毁所有Buffer
	 */
	destroyAllBuffers(): void {
		if (!this.bufferManager) {
			return
		}
		this.bufferManager.destroyAllBuffers()
	}

	/**
	 * 获取Buffer调试信息
	 * @param buffer 要查询的Buffer
	 * @returns 调试信息对象
	 */
	getBufferDebugInfo(buffer: Buffer): any {
		if (!this.bufferManager) {
			return null
		}
		return this.bufferManager.getBufferDebugInfo(buffer)
	}

	/**
	 * 获取所有Buffer的调试信息
	 * @returns 调试信息数组
	 */
	getAllBuffersDebugInfo(): Array<{ key: string; info: any }> {
		if (!this.bufferManager) {
			return []
		}
		return this.bufferManager.getAllBuffersDebugInfo()
	}

	/**
	 * 获取Buffer统计信息
	 * @returns 统计信息对象
	 */
	getBufferStats(): {
		totalBuffers: number
		totalMemoryUsage: number
		buffersByType: Record<string, number>
	} {
		if (!this.bufferManager) {
			return {
				totalBuffers: 0,
				totalMemoryUsage: 0,
				buffersByType: {},
			}
		}
		return this.bufferManager.getBufferStats()
	}

	/**
	 * 获取 Canvas Context
	 */
	getContext(): GPUCanvasContext {
		return this.context
	}
}
