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
	private bufferMap = new Map<string, Buffer>()

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
			default:
				throw new Error(`Unsupported buffer type: ${type}`)
		}
	}

	/**
	 * 创建单个 Buffer
	 */
	createBuffer(type: BufferType, options: CreateBufferOptions): Buffer {
		const usage = options.usage || this.getBufferUsage(type)

		const initialData = options.initialData as ArrayBuffer
		const buffer = new Buffer({
			resourceName: options.resourceName,
			size: options.size,
			usage,
			initialData,
			label: options.label,
		})
		buffer.initialize(this.device, initialData)

		this.bufferMap.set(buffer.id, buffer)

		return buffer
	}

	/**
	 * 根据 key 获取 Buffer
	 */
	getBuffer(key: string): Buffer | undefined {
		return this.bufferMap.get(key)
	}

	/**
	 * 根据资源名称获取 Buffer 列表
	 */
	getBuffersByResourceName(resourceName: string): Buffer[] {
		const buffers: Buffer[] = []
		for (const buffer of this.bufferMap.values()) {
			if (buffer.resourceName === resourceName) {
				buffers.push(buffer)
			}
		}
		return buffers
	}

	/**
	 * 根据类型获取 Buffer 列表
	 */
	getBuffersByType(type: BufferType): Buffer[] {
		const targetUsage = this.getBufferUsage(type)
		const buffers: Buffer[] = []

		for (const buffer of this.bufferMap.values()) {
			// 检查 usage 是否匹配
			if ((buffer.usage & targetUsage) === targetUsage) {
				buffers.push(buffer)
			}
		}
		return buffers
	}

	/**
	 * 获取所有 Buffer
	 */
	getAllBuffers(): Map<string, Buffer> {
		return new Map(this.bufferMap)
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

	/**
	 * 销毁指定的 Buffer
	 */
	destroyBuffer(buffer: Buffer): boolean {
		const key = buffer.id
		buffer.dispose()
		if (key in this.bufferMap) {
			this.bufferMap.delete(key)
			return true
		}
		return false
	}

	/**
	 * 根据 id 销毁 Buffer
	 */
	destroyBufferById(id: string): boolean {
		const buffer = this.bufferMap.get(id)
		if (buffer) {
			buffer.dispose()
			this.bufferMap.delete(id)
			return true
		}
		return false
	}

	/**
	 * 销毁所有 Buffer
	 */
	destroyAllBuffers(): void {
		for (const buffer of this.bufferMap.values()) {
			buffer.dispose()
		}
		this.bufferMap.clear()
	}

	/**
	 * 获取 Buffer 调试信息
	 */
	getBufferDebugInfo(buffer: Buffer): any {
		return buffer.getDebugInfo()
	}

	/**
	 * 获取所有 Buffer 的调试信息
	 */
	getAllBuffersDebugInfo(): Array<{ key: string; info: any }> {
		const debugInfos: Array<{ key: string; info: any }> = []
		for (const [key, buffer] of this.bufferMap.entries()) {
			debugInfos.push({
				key,
				info: buffer.getDebugInfo(),
			})
		}
		return debugInfos
	}

	/**
	 * 获取 Buffer 统计信息
	 */
	getBufferStats(): {
		totalBuffers: number
		totalMemoryUsage: number
		buffersByType: Record<string, number>
	} {
		const stats = {
			totalBuffers: this.bufferMap.size,
			totalMemoryUsage: 0,
			buffersByType: {} as Record<string, number>,
		}

		for (const buffer of this.bufferMap.values()) {
			const debugInfo = buffer.getDebugInfo() as any
			stats.totalMemoryUsage += debugInfo.size

			// 根据 usage 判断类型
			const usage = buffer.usage
			let type = 'unknown'
			if (usage & GPUBufferUsage.UNIFORM) type = 'uniform'
			else if (usage & GPUBufferUsage.STORAGE) type = 'storage'
			else if (usage & GPUBufferUsage.VERTEX) type = 'vertex'
			else if (usage & GPUBufferUsage.INDEX) type = 'index'

			stats.buffersByType[type] = (stats.buffersByType[type] || 0) + 1
		}

		return stats
	}
}
