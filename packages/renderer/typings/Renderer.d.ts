/// <reference types="dist" />
import Scene from './Scene';
import { Camera } from './camera/camera';
import { WebGPUBackend } from './backend';
type IProps = {
    canvas: HTMLCanvasElement;
    antialias?: boolean;
    clearColor?: [number, number, number, number];
    deviceLimits?: GPUDeviceDescriptor['requiredLimits'];
};
declare class Renderer {
    private ready;
    private backend;
    private constructor();
    static create(props: IProps): Promise<Renderer>;
    get width(): number;
    get height(): number;
    get device(): GPUDevice;
    get presentationFormat(): GPUTextureFormat;
    get resolutionBuf(): GPUBuffer;
    get antialias(): boolean;
    get webgpuBackend(): WebGPUBackend;
    get context(): GPUCanvasContext;
    resize: () => void;
    /**
     * 根据camera获取projectionMatrix和viewMatrix，遍历scene.children。
     * 从children[i]中获取到geometry和material。从geometry中获取顶点数据，从material中获取渲染管线（包含着色器）
     * 每个模型设置一次renderPass，最后统一提交到GPU
     * @param camera
     * @param scene
     */
    render(scene: Scene, camera: Camera): void;
}
export default Renderer;
