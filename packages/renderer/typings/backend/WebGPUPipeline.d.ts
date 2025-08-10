/// <reference types="dist" />
import { Blending } from '../types';
import Renderer from '../Renderer';
/**
 * WebGPU Pipeline 配置选WebGPUPipelineOptions项
 */
export interface WebGPUPipelineOptions {
    label: string;
    shaderCode: string;
    vertexEntry?: string;
    fragmentEntry?: string;
    vertexBufferLayouts: GPUVertexBufferLayout[];
    presentationFormat?: GPUTextureFormat;
    blending?: Blending;
    primitive?: GPUPrimitiveState;
    multisampleCount?: number;
    bindGroupLayoutDescriptors?: GPUBindGroupLayoutDescriptor[];
}
/**
 * Pipeline 请求参数，包含版本信息
 */
export interface PipelineRequest {
    id: string;
    version: number;
    options: WebGPUPipelineOptions;
}
/**
 * WebGPU Pipeline 管理器
 * 负责统一管理 WebGPU Pipeline 的创建、配置和缓存
 */
export declare class WebGPUPipelineManager {
    private device;
    private pipelineCache;
    private shaderModuleCache;
    constructor(device: GPUDevice);
    /**
     * 创建或获取缓存的 Shader Module
     */
    private getOrCreateShaderModule;
    private generateShaderCacheKey;
    private generatePipelineCacheKey;
    /**
     * 清理指定ID的旧版本缓存
     */
    private clearOldVersions;
    /**
     * 根据指定的混合类型创建对应的WebGPU混合状态配置
     * @param blending 混合模式类型
     * @returns GPUBlendState配置对象，如果不需要混合则返回undefined
     */
    private configureBlending;
    /**
     * 根据请求参数获取或创建渲染管线
     */
    getOrCreatePipeline(request: PipelineRequest, renderer: Renderer): GPURenderPipeline;
    /**
     * 获取管线的绑定组布局
     */
    getBindGroupLayout(pipeline: GPURenderPipeline, index: number): GPUBindGroupLayout;
    /**
     * 清除缓存
     */
    clearCache(): void;
    /**
     * 清除指定ID和版本的管线缓存
     */
    clearPipelineCache(id: string, version: number): boolean;
    /**
     * 获取缓存统计信息
     */
    getCacheStats(): {
        pipelineCount: number;
        shaderModuleCount: number;
    };
}
