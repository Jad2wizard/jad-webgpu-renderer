/// <reference types="dist" />
export declare class WebGPUUtils {
    static initWebGPU(canvas: HTMLCanvasElement, options?: {
        antiAlias?: boolean;
        deviceLimits?: GPUDeviceDescriptor['requiredLimits'];
    }): Promise<{
        device: GPUDevice;
        context: GPUCanvasContext;
        format: GPUTextureFormat;
    }>;
}
