/// <reference types="dist" />
import { ShaderDataDefinitions } from 'webgpu-utils';
import { Blending } from '../types';
import Renderer from '../Renderer';
import { TypedArray } from '../types';
import { Camera } from '@renderer/camera/camera';
import Uniform from './uniform';
import Storage from './storage';
import { WebGPUBuffer } from '@renderer/backend/WebGPUBuffer';
import { WebGPUBackend } from '@renderer/backend';
type IProps = {
    id: string;
    renderCode: string;
    vertexShaderEntry?: string;
    fragmentShaderEntry?: string;
    uniforms?: Record<string, any>;
    storages?: Record<string, TypedArray | undefined | Storage>;
    blending?: Blending;
    presentationFormat?: GPUTextureFormat;
    renderBindGroupLayoutDescriptors?: GPUBindGroupLayoutDescriptor[];
    multisampleCount?: number;
    primitive?: GPUPrimitiveState;
};
declare class Material {
    private id;
    private pipelineVersion;
    private _vsEntry;
    private _fsEntry;
    protected code: string;
    protected uniforms: Record<string, Uniform>;
    protected storages: Record<string, Storage>;
    protected _blending: Blending;
    protected _defs: ShaderDataDefinitions;
    protected textureInfos: Record<string, {
        group: number;
        binding: number;
    }>;
    private bindGroupLayoutDescriptors?;
    private presentationFormat?;
    private multisampleCount?;
    private _primitive?;
    constructor(props: IProps);
    get blending(): Blending;
    get primitive(): GPUPrimitiveState | undefined;
    get vsEntry(): string;
    get fsEntry(): string;
    changeBlending(b: Blending | undefined): void;
    changeShaderCode(renderCode: string): void;
    changePrimitive(p?: GPUPrimitiveState): void;
    changeVsEntry(entry: string): void;
    changeFsEntry(entry: string): void;
    private invalidatePipeline;
    protected parseShaderCodeAndInitResource(props: IProps): ShaderDataDefinitions;
    getUniform(name: string): Uniform | null;
    getUniforms(): Record<string, Uniform>;
    getStorage(name: string): Storage | null;
    getStorages(): Record<string, Storage>;
    updateUniform(uniformName: string, value: any): void;
    updateStorage(storageName: string, value: TypedArray): void;
    getBuffers(backend: WebGPUBackend): WebGPUBuffer[];
    getPipeline(renderer: Renderer, vertexBufferLayouts: GPUVertexBufferLayout[]): GPURenderPipeline;
    /**
     * 创建并返回WebGPU绑定组
     * 该方法负责将材质中的uniform、storage和纹理资源绑定到GPU管线中
     * @param renderer 渲染器实例，提供GPU设备和分辨率缓冲区
     * @param camera 相机实例，提供投影矩阵和视图矩阵缓冲区
     * @param backend WebGPU后端实例，用于更新缓冲区
     * @param textures 纹理资源映射表，键为纹理名称，值为GPU纹理对象
     * @returns 包含绑定组数组和组索引列表的对象
     */
    getBindGroups(renderer: Renderer, camera: Camera, backend: WebGPUBackend, textures: Record<string, GPUTexture>, vertexBufferLayouts: GPUVertexBufferLayout[]): {
        bindGroups: GPUBindGroup[];
        groupIndexList: number[];
    };
    dispose(): void;
}
export default Material;
