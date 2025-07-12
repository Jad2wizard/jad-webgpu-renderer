import { Color } from '@/types'
import Scene from '../Scene'
import { Camera } from '../camera/camera'
import { WebGPUUtils } from './WebGPUUtils'
import { normalizeColor } from '@/utils'
import Renderer from '@/Renderer'
import { BufferManager, BufferType, CreateBufferOptions, WebGPUBuffer } from './WebGPUBuffer'
import { WebGPUPipelineManager } from './WebGPUPipeline'
import type { WebGPUPipelineOptions } from './WebGPUPipeline'
import { WebGPUBindGroupManager } from './WebGPUBindGroup'
import type { BindGroupEntryConfig, SystemUniformType } from './WebGPUBindGroup'

// 导出 Pipeline 相关类和接口
export { WebGPUPipelineManager }
export type { WebGPUPipelineOptions }

// 导出 BindGroup 相关类和接口
export { WebGPUBindGroupManager }
export type { BindGroupEntryConfig, SystemUniformType }

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

			this.context.configure({
				device,
				format,
				alphaMode: 'premultiplied',
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
	public render(scene: Scene, camera: Camera, renderer: Renderer) {
		// const s = new Date().valueOf()
		camera.updateMatrixBuffers(this.device)
		const { device, renderPassDescriptor } = this

		this.updateRenderPassDescriptor()

		const encoder = device.createCommandEncoder()

		for (let model of scene.modelList) {
			model.prevRender(renderer, encoder, camera)
		}

		const pass = encoder.beginRenderPass(renderPassDescriptor)
		for (let model of scene.modelList) {
			if (model.visible) model.render(renderer, pass, camera)
		}

		pass.end()

		const commandBuffer = encoder.finish()
		this.device.queue.submit([commandBuffer])

		// await this.device.queue.onSubmittedWorkDone()
		// for (let model of scene.modelList){
		// }
		// for (let model of scene.modelList) {
		// 	if (model instanceof Heatmap) {
		// 		await delay(50)
		// 		await model.setMaxMinHeatValue(this, 'max')
		// 		await model.setMaxMinHeatValue(this, 'min')
		// 	}
		// }
		// console.log(new Date().valueOf() - s)
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
	 */
	getBindGroupManager(): WebGPUBindGroupManager {
		return this.bindGroupManager
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
	}): WebGPUBuffer {
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
	 * @returns WebGPUBuffer实例或undefined
	 */
	getBuffer(id: string): WebGPUBuffer | undefined {
		if (!this.bufferManager) {
			return undefined
		}
		return this.bufferManager.getBuffer(id)
	}

	/**
	 * 根据资源名称获取Buffer列表
	 * @param resourceName 资源名称
	 * @returns WebGPUBuffer数组
	 */
	getBuffersByResourceName(resourceName: string): WebGPUBuffer[] {
		if (!this.bufferManager) {
			return []
		}
		return this.bufferManager.getBuffersByResourceName(resourceName)
	}

	/**
	 * 根据类型获取Buffer列表
	 * @param type Buffer类型
	 * @returns WebGPUBuffer数组
	 */
	getBuffersByType(type: BufferType): WebGPUBuffer[] {
		if (!this.bufferManager) {
			return []
		}
		return this.bufferManager.getBuffersByType(type)
	}

	/**
	 * 获取所有Buffer
	 * @returns Buffer映射表
	 */
	getAllBuffers(): Map<string, WebGPUBuffer> {
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
	updateBuffer(
		buffer: WebGPUBuffer,
		data: ArrayBuffer | ArrayBufferView,
		offset: number = 0
	): void {
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
	destroyBuffer(buffer: WebGPUBuffer): boolean {
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
	getBufferDebugInfo(buffer: WebGPUBuffer): any {
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
