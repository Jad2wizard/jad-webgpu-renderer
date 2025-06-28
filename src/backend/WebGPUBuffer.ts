import { genId } from '@/utils/index'

export interface WebGPUBufferOptions {
	resourceName: string
	size: number
	usage: GPUBufferUsageFlags
	label?: string
	initialData?: ArrayBuffer
}

/**
 * Buffer 类型枚举
 */
export enum BufferType {
	UNIFORM = 'uniform',
	STORAGE = 'storage',
	VERTEX = 'vertex',
	INDEX = 'index',
	READ_WRITE_STORAGE = 'readWriteStorage',
}

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
	private bufferMap = new Map<string, WebGPUBuffer>()

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
	createBuffer(type: BufferType, options: CreateBufferOptions): WebGPUBuffer {
		const usage = options.usage || this.getBufferUsage(type)

		const bufferOptions: WebGPUBufferOptions = {
			resourceName: options.resourceName,
			size: options.size,
			usage,
			initialData: options.initialData as ArrayBuffer,
			label: options.label,
		}

		const buffer = new WebGPUBuffer(bufferOptions)
		buffer.initialize(this.device, bufferOptions.initialData)

		const key = buffer.id
		this.bufferMap.set(key, buffer)

		return buffer
	}

	/**
	 * 根据 key 获取 Buffer
	 */
	getBuffer(key: string): WebGPUBuffer | undefined {
		return this.bufferMap.get(key)
	}

	/**
	 * 根据资源名称获取 Buffer 列表
	 */
	getBuffersByResourceName(resourceName: string): WebGPUBuffer[] {
		const buffers: WebGPUBuffer[] = []
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
	getBuffersByType(type: BufferType): WebGPUBuffer[] {
		const targetUsage = this.getBufferUsage(type)
		const buffers: WebGPUBuffer[] = []

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
	getAllBuffers(): Map<string, WebGPUBuffer> {
		return new Map(this.bufferMap)
	}

	/**
	 * 更新 Buffer 数据
	 */
	updateBuffer(
		buffer: WebGPUBuffer,
		data: ArrayBuffer | ArrayBufferView,
		offset: number = 0
	): void {
		const arrayBuffer =
			data instanceof ArrayBuffer
				? data
				: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
		buffer.updateData(arrayBuffer, offset)
	}

	/**
	 * 销毁指定的 Buffer
	 */
	destroyBuffer(buffer: WebGPUBuffer): boolean {
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
	getBufferDebugInfo(buffer: WebGPUBuffer): any {
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

export class WebGPUBuffer {
	private _id: string
	private _resourceName: string
	private _size: number
	private _usage: GPUBufferUsageFlags
	private _buffer: GPUBuffer | null = null
	private _needsUpdate = true
	private _device: GPUDevice | null = null

	constructor(options: WebGPUBufferOptions) {
		console.log(`label: ${options.label}\t resource name: ${options.resourceName}`)
		this._id = options.label + '-buffer'
		this._resourceName = options.resourceName
		this._size = options.size
		this._usage = options.usage
	}

	get id(): string {
		return this._id
	}

	get resourceName(): string {
		return this._resourceName
	}

	get size(): number {
		return this._size
	}

	get usage(): GPUBufferUsageFlags {
		return this._usage
	}

	get needsUpdate(): boolean {
		return this._needsUpdate
	}

	set needsUpdate(value: boolean) {
		this._needsUpdate = value
	}

	get GPUBuffer(): GPUBuffer | null {
		return this._buffer
	}

	get isInitialized(): boolean {
		return this._buffer !== null
	}

	// 检查是否为Uniform Buffer
	get isUniformBuffer(): boolean {
		return !!(this._usage & GPUBufferUsage.UNIFORM)
	}

	// 检查是否为Storage Buffer
	get isStorageBuffer(): boolean {
		return !!(this._usage & GPUBufferUsage.STORAGE)
	}

	// 检查是否为Vertex Buffer
	get isVertexBuffer(): boolean {
		return !!(this._usage & GPUBufferUsage.VERTEX)
	}

	// 检查是否为Index Buffer
	get isIndexBuffer(): boolean {
		return !!(this._usage & GPUBufferUsage.INDEX)
	}

	// 检查是否为可读写Storage Buffer
	get isReadWriteStorageBuffer(): boolean {
		return (
			!!(this._usage & GPUBufferUsage.STORAGE) &&
			!!(this._usage & GPUBufferUsage.COPY_SRC) &&
			!!(this._usage & GPUBufferUsage.COPY_DST)
		)
	}

	/**
	 * 初始化GPU Buffer
	 * @param device WebGPU设备
	 * @param initialData 可选的初始数据
	 */
	public initialize(device: GPUDevice, initialData?: ArrayBuffer): void {
		if (this._buffer) {
			this.dispose()
		}

		this._device = device
		this._buffer = device.createBuffer({
			label: this._id,
			size: this._size,
			usage: this._usage,
		})

		if (initialData) {
			this.updateData(initialData)
		}

		this._needsUpdate = false
	}

	/**
	 * 更新Buffer数据
	 * @param data 要写入的数据
	 * @param offset 写入偏移量，默认为0
	 */
	public updateData(data: ArrayBuffer, offset: number = 0): boolean {
		if (!this._buffer || !this._device) {
			console.warn(`WebGPUBuffer ${this._id} not initialized`)
			return false
		}

		if (data.byteLength + offset > this._size) {
			// 如果数据超出当前Buffer大小，重新创建更大的Buffer
			this._size = data.byteLength + offset
			this.initialize(this._device, data)
			return true
		}

		this._device.queue.writeBuffer(this._buffer, offset, data)
		this._needsUpdate = false
		return true
	}

	/**
	 * 调整Buffer大小（改进版本）
	 * @param newSize 新的大小
	 * @param preserveData 是否保留现有数据
	 */
	public resize(newSize: number, preserveData: boolean = false): void {
		if (!this._device) {
			console.warn(`WebGPUBuffer ${this._id} not initialized`)
			return
		}

		if (newSize === this._size) {
			return
		}

		if (!preserveData || !this._buffer) {
			// 不保留数据，直接重新创建
			this._size = newSize
			this.initialize(this._device)
			return
		}

		// 保留数据的情况
		const oldBuffer = this._buffer
		const copySize = Math.min(this._size, newSize)

		// 创建新buffer
		const newBuffer = this._device.createBuffer({
			label: this._id,
			size: newSize,
			usage: this._usage,
		})

		// 复制数据
		const commandEncoder = this._device.createCommandEncoder()
		commandEncoder.copyBufferToBuffer(oldBuffer, 0, newBuffer, 0, copySize)

		// 提交命令并等待完成
		const commandBuffer = commandEncoder.finish()
		this._device.queue.submit([commandBuffer])

		// 等待GPU操作完成后再销毁旧buffer
		this._device.queue.onSubmittedWorkDone().then(() => {
			oldBuffer.destroy()
		})

		// 更新引用
		this._buffer = newBuffer
		this._size = newSize
		this._needsUpdate = false
	}

	/**
	 * 创建Buffer的绑定组条目
	 * @param binding 绑定点
	 * @param offset 偏移量
	 * @param size 大小，如果不指定则使用整个Buffer
	 */
	public createBindGroupEntry(
		binding: number,
		offset?: number,
		size?: number
	): GPUBindGroupEntry {
		if (!this._buffer) {
			throw new Error(`WebGPUBuffer ${this._id} not initialized`)
		}

		return {
			binding,
			resource: {
				buffer: this._buffer,
				offset: offset || 0,
				size: size || this._size,
			},
		}
	}

	/**
	 * 克隆Buffer配置（不包括GPU资源）
	 */
	public clone(): WebGPUBuffer {
		return new WebGPUBuffer({
			resourceName: this._resourceName,
			size: this._size,
			usage: this._usage,
			label: `${this._id}_clone`,
		})
	}

	/**
	 * 释放GPU资源
	 */
	public dispose(): void {
		if (this._buffer) {
			this._buffer.destroy()
			this._buffer = null
		}
		this._device = null
		this._needsUpdate = true
	}

	/**
	 * 获取Buffer的调试信息
	 */
	public getDebugInfo(): object {
		return {
			id: this._id,
			resourceName: this._resourceName,
			size: this._size,
			usage: this._usage,
			isInitialized: this.isInitialized,
			needsUpdate: this._needsUpdate,
			bufferType: {
				uniform: this.isUniformBuffer,
				storage: this.isStorageBuffer,
				vertex: this.isVertexBuffer,
				index: this.isIndexBuffer,
				readWriteStorage: this.isReadWriteStorageBuffer,
			},
		}
	}
}
