/// <reference types="dist" />
import type { Camera } from '../camera/camera';
import type Renderer from '../Renderer';
import type Model from '../Model';
/**
 * WebGPU 渲染通道管理器
 * 负责管理渲染通道的创建和执行
 */
export declare class WebGPURenderPassManager {
    private device;
    constructor(device: GPUDevice);
    /**
     * 执行热力图渲染通道
     * @param encoder 命令编码器
     * @param heatPointsModel 热力点模型
     * @param heatValTexture 热力值纹理
     * @param renderer 渲染器
     * @param camera 相机
     */
    executeHeatPointsRenderPass(encoder: GPUCommandEncoder, heatPointsModel: Model, heatValTexture: GPUTexture, renderer: Renderer, camera: Camera): void;
    /**
     * 执行最大热力值渲染通道
     * @param encoder 命令编码器
     * @param maxHeatValueModel 最大热力值模型
     * @param maxHeatValTexture 最大热力值纹理
     * @param renderer 渲染器
     * @param camera 相机
     * @param textures 额外纹理
     */
    executeMaxHeatValueRenderPass(encoder: GPUCommandEncoder, maxHeatValueModel: Model, maxHeatValTexture: GPUTexture, renderer: Renderer, camera: Camera, textures?: Record<string, GPUTexture>): void;
    /**
     * 创建通用渲染通道描述符
     * @param label 标签
     * @param texture 目标纹理
     * @param clearColor 清除颜色
     * @param loadOp 加载操作
     * @param storeOp 存储操作
     * @returns GPURenderPassDescriptor
     */
    createRenderPassDescriptor(label: string, texture: GPUTexture, clearColor?: GPUColor, loadOp?: GPULoadOp, storeOp?: GPUStoreOp): GPURenderPassDescriptor;
    /**
     * 执行通用渲染通道
     * @param encoder 命令编码器
     * @param renderPassDesc 渲染通道描述符
     * @param renderCallback 渲染回调函数
     */
    executeRenderPass(encoder: GPUCommandEncoder, renderPassDesc: GPURenderPassDescriptor, renderCallback: (pass: GPURenderPassEncoder) => void): void;
}
