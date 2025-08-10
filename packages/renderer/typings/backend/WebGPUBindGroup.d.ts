/// <reference types="dist" />
import { Camera } from '../camera/camera';
import Renderer from '../Renderer';
import { WebGPUBackend } from '../backend';
import Uniform from '../material/uniform';
import Storage from '../material/storage';
/**
 * BindGroup 条目配置接口
 */
export interface BindGroupEntryConfig {
    binding: number;
    resource: GPUBindingResource;
}
/**
 * 系统 Uniform 类型枚举
 */
export declare enum SystemUniformType {
    PROJECTION_MATRIX = "projectionMatrix",
    VIEW_MATRIX = "viewMatrix",
    RESOLUTION = "resolution"
}
/**
 * WebGPU BindGroup 管理器
 * 负责统一管理 WebGPU BindGroup 的创建、配置和资源绑定
 */
export declare class WebGPUBindGroupManager {
    private device;
    constructor(device: GPUDevice);
    /**
     * 获取系统 Uniform 的 Buffer
     * @param uniformType 系统 Uniform 类型
     * @param renderer 渲染器实例
     * @param camera 相机实例
     * @returns GPU Buffer 或 null
     */
    private getSystemUniformBuffer;
    /**
     * 为材质创建 BindGroups
     * @param pipeline 渲染管线
     * @param uniforms Uniform 变量映射
     * @param storages Storage 变量映射
     * @param textureInfos 纹理信息映射
     * @param renderer 渲染器实例
     * @param camera 相机实例
     * @param backend WebGPU 后端实例
     * @param textures 纹理资源映射
     * @returns 包含绑定组数组和组索引列表的对象
     */
    createMaterialBindGroups(label: string, pipeline: GPURenderPipeline, uniforms: Record<string, Uniform>, storages: Record<string, Storage>, textureInfos: Record<string, {
        group: number;
        binding: number;
    }>, renderer: Renderer, camera: Camera, backend: WebGPUBackend, textures: Record<string, GPUTexture>): {
        bindGroups: GPUBindGroup[];
        groupIndexList: number[];
    };
}
