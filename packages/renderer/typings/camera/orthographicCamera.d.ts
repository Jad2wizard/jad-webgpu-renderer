/// <reference types="dist" />
import { OrthographicCamera as ThreeOrthographicCamera } from 'three';
import { ICamera } from './camera';
declare class OrthographicCamera extends ThreeOrthographicCamera implements ICamera {
    private projectionMatBuf;
    private viewMatBuf;
    constructor(left?: number, right?: number, top?: number, bottom?: number, near?: number, far?: number);
    getProjectionMatBuf(device: GPUDevice): GPUBuffer;
    getViewMatBuf(device: GPUDevice): GPUBuffer;
    updateMatrixBuffers(device: GPUDevice): void;
}
export default OrthographicCamera;
