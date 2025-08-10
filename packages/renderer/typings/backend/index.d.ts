/// <reference types="dist" />
import Scene from '../Scene';
import { Camera } from '../camera/camera';
import Renderer from '../Renderer';
import { BufferManager, BufferType, WebGPUBuffer } from './WebGPUBuffer';
import { WebGPUPipelineManager } from './WebGPUPipeline';
import type { WebGPUPipelineOptions } from './WebGPUPipeline';
import { WebGPUBindGroupManager } from './WebGPUBindGroup';
import type { BindGroupEntryConfig, SystemUniformType } from './WebGPUBindGroup';
import { WebGPUTextureManager } from './WebGPUTextureManager';
import { WebGPURenderPassManager } from './WebGPURenderPassManager';
export { WebGPUPipelineManager };
export type { WebGPUPipelineOptions };
export { WebGPUBindGroupManager };
export type { BindGroupEntryConfig, SystemUniformType };
export { WebGPUTextureManager };
export { WebGPURenderPassManager };
export declare class WebGPUBackend {
    private device;
    private context;
    private format;
    private canvas;
    private renderPassDescriptor;
    private clearColor;
    private antialias;
    private deviceLimits?;
    private multisampleTexture;
    private resolutionBuf;
    private bufferManager;
    private pipelineManager;
    private bindGroupManager;
    private textureManager;
    private renderPassManager;
    constructor(canvas: HTMLCanvasElement, options?: {
        clearColor?: [number, number, number, number];
        antialias?: boolean;
        deviceLimits?: GPUDeviceDescriptor['requiredLimits'];
    });
    getAntialias(): boolean;
    setAntialias(v: boolean): void;
    getWidth(): number;
    getHeight(): number;
    getDevice(): GPUDevice;
    getPresentationFormat(): GPUTextureFormat;
    getRenderPassDescriptor(renderTarget?: GPUTexture): GPURenderPassDescriptor;
    init(): Promise<void>;
    getResolutionBuffer(): GPUBuffer;
    /**
     * 根据camera获取projectionMatrix和viewMatrix，遍历scene.children。
     * 从children[i]中获取到geometry和material。从geometry中获取顶点数据，从material中获取渲染管线（包含着色器）
     * 每个模型设置一次renderPass，最后统一提交到GPU
     * @param camera
     * @param scene
     */
    render(scene: Scene, camera: Camera, renderer: Renderer): void;
    resize(): void;
    private createMultisampleTexture;
    private updateRenderPassDescriptor;
    private updateResolution;
    /**
     * 获取 BufferManager 实例
     */
    getBufferManager(): BufferManager;
    /**
     * 获取 PipelineManager 实例
     */
    getPipelineManager(): WebGPUPipelineManager;
    /**
     * 获取 BindGroupManager 实例
     * @returns BindGroupManager 实例
     */
    getBindGroupManager(): WebGPUBindGroupManager;
    /**
     * 获取 TextureManager 实例
     * @returns TextureManager 实例
     */
    getTextureManager(): WebGPUTextureManager;
    /**
     * 获取 RenderPassManager 实例
     * @returns RenderPassManager 实例
     */
    getRenderPassManager(): WebGPURenderPassManager;
    /**
     * 统一的 Buffer 创建函数（替换所有类型特定的创建方法）
     * @param options 创建选项
     * @returns WebGPUBuffer实例
     */
    createBuffer(options: {
        type: BufferType;
        resourceName: string;
        size: number;
        initialData?: ArrayBuffer | ArrayBufferView;
        label: string;
    }): WebGPUBuffer;
    /**
     * 根据ID获取Buffer
     * @param id Buffer的ID
     * @returns WebGPUBuffer实例或undefined
     */
    getBuffer(id: string): WebGPUBuffer | undefined;
    /**
     * 根据资源名称获取Buffer列表
     * @param resourceName 资源名称
     * @returns WebGPUBuffer数组
     */
    getBuffersByResourceName(resourceName: string): WebGPUBuffer[];
    /**
     * 根据类型获取Buffer列表
     * @param type Buffer类型
     * @returns WebGPUBuffer数组
     */
    getBuffersByType(type: BufferType): WebGPUBuffer[];
    /**
     * 获取所有Buffer
     * @returns Buffer映射表
     */
    getAllBuffers(): Map<string, WebGPUBuffer>;
    /**
     * 更新Buffer数据
     * @param buffer 要更新的Buffer
     * @param data 新数据
     * @param offset 偏移量，默认为0
     */
    updateBuffer(buffer: WebGPUBuffer, data: ArrayBuffer | ArrayBufferView, offset?: number): void;
    /**
     * 销毁指定的Buffer
     * @param buffer 要销毁的Buffer
     * @returns 是否成功销毁
     */
    destroyBuffer(buffer: WebGPUBuffer): boolean;
    /**
     * 根据ID销毁Buffer
     * @param id Buffer的ID
     * @returns 是否成功销毁
     */
    destroyBufferById(id: string): boolean;
    /**
     * 销毁所有Buffer
     */
    destroyAllBuffers(): void;
    /**
     * 获取Buffer调试信息
     * @param buffer 要查询的Buffer
     * @returns 调试信息对象
     */
    getBufferDebugInfo(buffer: WebGPUBuffer): any;
    /**
     * 获取所有Buffer的调试信息
     * @returns 调试信息数组
     */
    getAllBuffersDebugInfo(): Array<{
        key: string;
        info: any;
    }>;
    /**
     * 获取Buffer统计信息
     * @returns 统计信息对象
     */
    getBufferStats(): {
        totalBuffers: number;
        totalMemoryUsage: number;
        buffersByType: Record<string, number>;
    };
    /**
     * 获取 Canvas Context
     */
    getContext(): GPUCanvasContext;
}
