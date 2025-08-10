/// <reference types="dist" />
import { PerspectiveCamera as ThreePerspectiveCamera } from 'three';
import { ICamera } from './camera';
declare class PerspectiveCamera extends ThreePerspectiveCamera implements ICamera {
    private projectionMatBuf;
    private viewMatBuf;
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    getProjectionMatBuf(device: GPUDevice): GPUBuffer;
    getViewMatBuf(device: GPUDevice): GPUBuffer;
    updateMatrixBuffers(device: GPUDevice): void;
}
export default PerspectiveCamera;
