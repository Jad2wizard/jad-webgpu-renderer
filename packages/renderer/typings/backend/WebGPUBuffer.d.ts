/// <reference types="dist" />
export interface WebGPUBufferOptions {
    resourceName: string;
    size: number;
    usage: GPUBufferUsageFlags;
    label?: string;
    initialData?: ArrayBuffer;
}
/**
 * Buffer 类型枚举
 */
export declare enum BufferType {
    UNIFORM = "uniform",
    STORAGE = "storage",
    VERTEX = "vertex",
    INDEX = "index",
    READ_WRITE_STORAGE = "readWriteStorage"
}
/**
 * 创建 Buffer 的选项接口
 */
export interface CreateBufferOptions {
    resourceName: string;
    size: number;
    initialData?: ArrayBuffer | ArrayBufferView;
    usage?: GPUBufferUsageFlags;
    label?: string;
}
/**
 * Buffer 管理器类
 * 负责统一管理 WebGPU Buffer 的创建、查询、更新和销毁
 */
export declare class BufferManager {
    private device;
    private bufferMap;
    constructor(device: GPUDevice);
    /**
     * 根据类型获取对应的 usage 标志
     */
    private getBufferUsage;
    /**
     * 创建单个 Buffer
     */
    createBuffer(type: BufferType, options: CreateBufferOptions): WebGPUBuffer;
    /**
     * 根据 key 获取 Buffer
     */
    getBuffer(key: string): WebGPUBuffer | undefined;
    /**
     * 根据资源名称获取 Buffer 列表
     */
    getBuffersByResourceName(resourceName: string): WebGPUBuffer[];
    /**
     * 根据类型获取 Buffer 列表
     */
    getBuffersByType(type: BufferType): WebGPUBuffer[];
    /**
     * 获取所有 Buffer
     */
    getAllBuffers(): Map<string, WebGPUBuffer>;
    /**
     * 更新 Buffer 数据
     */
    updateBuffer(buffer: WebGPUBuffer, data: ArrayBuffer | ArrayBufferView, offset?: number): void;
    /**
     * 销毁指定的 Buffer
     */
    destroyBuffer(buffer: WebGPUBuffer): boolean;
    /**
     * 根据 id 销毁 Buffer
     */
    destroyBufferById(id: string): boolean;
    /**
     * 销毁所有 Buffer
     */
    destroyAllBuffers(): void;
    /**
     * 获取 Buffer 调试信息
     */
    getBufferDebugInfo(buffer: WebGPUBuffer): any;
    /**
     * 获取所有 Buffer 的调试信息
     */
    getAllBuffersDebugInfo(): Array<{
        key: string;
        info: any;
    }>;
    /**
     * 获取 Buffer 统计信息
     */
    getBufferStats(): {
        totalBuffers: number;
        totalMemoryUsage: number;
        buffersByType: Record<string, number>;
    };
}
export declare class WebGPUBuffer {
    private _id;
    private _resourceName;
    private _size;
    private _usage;
    private _buffer;
    private _needsUpdate;
    private _device;
    constructor(options: WebGPUBufferOptions);
    get id(): string;
    get resourceName(): string;
    get size(): number;
    get usage(): GPUBufferUsageFlags;
    get needsUpdate(): boolean;
    set needsUpdate(value: boolean);
    get GPUBuffer(): GPUBuffer | null;
    get isInitialized(): boolean;
    get isUniformBuffer(): boolean;
    get isStorageBuffer(): boolean;
    get isVertexBuffer(): boolean;
    get isIndexBuffer(): boolean;
    get isReadWriteStorageBuffer(): boolean;
    /**
     * 初始化GPU Buffer
     * @param device WebGPU设备
     * @param initialData 可选的初始数据
     */
    initialize(device: GPUDevice, initialData?: ArrayBuffer): void;
    /**
     * 更新Buffer数据
     * @param data 要写入的数据
     * @param offset 写入偏移量，默认为0
     */
    updateData(data: ArrayBuffer, offset?: number): boolean;
    /**
     * 调整Buffer大小（改进版本）
     * @param newSize 新的大小
     * @param preserveData 是否保留现有数据
     */
    resize(newSize: number, preserveData?: boolean): void;
    /**
     * 创建Buffer的绑定组条目
     * @param binding 绑定点
     * @param offset 偏移量
     * @param size 大小，如果不指定则使用整个Buffer
     */
    createBindGroupEntry(binding: number, offset?: number, size?: number): GPUBindGroupEntry;
    /**
     * 克隆Buffer配置（不包括GPU资源）
     */
    clone(): WebGPUBuffer;
    /**
     * 释放GPU资源
     */
    dispose(): void;
    /**
     * 获取Buffer的调试信息
     */
    getDebugInfo(): object;
}
