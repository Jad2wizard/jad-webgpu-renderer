import PerspectiveCamera from './perspectiveCamera'
import OrthographicCamera from './orthographicCamera'

export interface ICamera {
	getProjectionMatBuf(device: GPUDevice): GPUBuffer
	getViewMatBuf(device: GPUDevice): GPUBuffer
	updateMatrixBuffers(device: GPUDevice): void
}

export type Camera = PerspectiveCamera | OrthographicCamera
