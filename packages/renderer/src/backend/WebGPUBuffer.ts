import { Buffer, BufferType, BufferOptions } from './Buffer'

export { BufferType }
export type WebGPUBufferOptions = BufferOptions
export type WebGPUBuffer = Buffer
export const WebGPUBuffer = Buffer

/**
 * 创建 Buffer 的选项接口
 */
export interface CreateBufferOptions {
	resourceName: string
	size: number
	initialData?: ArrayBuffer | ArrayBufferView
	usage?: GPUBufferUsageFlags // 可选的自定义 usage
	label?: string
}

/**
 * Buffer 管理器类
 * 负责统一管理 WebGPU Buffer 的创建、查询、更新和销毁
 */
export class BufferManager {
	private device: GPUDevice

	constructor(device: GPUDevice) {
		this.device = device
	}

	/**
	 * 根据类型获取对应的 usage 标志
	 */
	private getBufferUsage(type: BufferType): GPUBufferUsageFlags {
		switch (type) {
			case BufferType.UNIFORM:
				return GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			case BufferType.STORAGE:
				return GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
			case BufferType.VERTEX:
				return GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
			case BufferType.INDEX:
				return GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
			case BufferType.READ_WRITE_STORAGE:
				return GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
			case BufferType.VERTEX_STORAGE:
				return GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
			default:
				throw new Error(`Unsupported buffer type: ${type}`)
		}
	}

	/**
	 * 创建单个 Buffer
	 */
	createBuffer(type: BufferType, options: CreateBufferOptions): Buffer {
		const usage = options.usage || this.getBufferUsage(type)

		const initialData =
			options.initialData instanceof ArrayBuffer
				? options.initialData
				: options.initialData
					? (options.initialData.buffer.slice(
							options.initialData.byteOffset,
							options.initialData.byteOffset + options.initialData.byteLength
						) as ArrayBuffer)
					: undefined
		const buffer = new Buffer({
			resourceName: options.resourceName,
			size: options.size,
			usage,
			label: options.label,
		})
		buffer.initialize(this.device, initialData)

		return buffer
	}

	/**
	 * 更新 Buffer 数据
	 */
	updateBuffer(buffer: Buffer, data: ArrayBuffer | ArrayBufferView, offset: number = 0): void {
		const arrayBuffer =
			data instanceof ArrayBuffer
				? data
				: (data.buffer.slice(
						data.byteOffset,
						data.byteOffset + data.byteLength
					) as ArrayBuffer)
		buffer.updateData(arrayBuffer, offset)
	}
}
