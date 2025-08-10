/// <reference types="dist" />
/**
 * WebGPU 纹理管理器
 * 负责创建和管理各种类型的纹理
 */
export declare class WebGPUTextureManager {
    private device;
    constructor(device: GPUDevice);
    /**
     * 创建热力图值纹理
     * @param width 纹理宽度
     * @param height 纹理高度
     * @returns GPUTexture
     */
    createHeatValueTexture(width: number, height: number): GPUTexture;
    /**
     * 创建最大热力值纹理
     * @returns GPUTexture
     */
    createMaxHeatValueTexture(): GPUTexture;
    /**
     * 创建通用纹理
     * @param options 纹理创建选项
     * @returns GPUTexture
     */
    createTexture(options: GPUTextureDescriptor): GPUTexture;
    /**
     * 创建渲染通道描述符
     * @param label 标签
     * @param texture 目标纹理
     * @param clearColor 清除颜色
     * @returns GPURenderPassDescriptor
     */
    createRenderPassDescriptor(label: string, texture: GPUTexture, clearColor?: GPUColor): GPURenderPassDescriptor;
    /**
     * 创建多重采样纹理
     * @param width 宽度
     * @param height 高度
     * @param format 格式
     * @param sampleCount 采样数
     * @returns GPUTexture
     */
    createMultisampleTexture(width: number, height: number, format: GPUTextureFormat, sampleCount?: number): GPUTexture;
}
