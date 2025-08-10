import { OrthographicCamera as ThreeOrthographicCamera } from 'three'
import { ICamera } from './camera'

class OrthographicCamera extends ThreeOrthographicCamera implements ICamera {
	private projectionMatBuf: GPUBuffer | undefined
	private viewMatBuf: GPUBuffer | undefined
	constructor(left?: number, right?: number, top?: number, bottom?: number, near?: number, far?: number) {
		super(left, right, top, bottom, near, far)
	}

	getProjectionMatBuf(device: GPUDevice): GPUBuffer {
		if (!this.projectionMatBuf)
			this.projectionMatBuf = device.createBuffer({
				size: 16 * 4,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			})
		return this.projectionMatBuf
	}

	getViewMatBuf(device: GPUDevice): GPUBuffer {
		if (!this.viewMatBuf)
			this.viewMatBuf = device.createBuffer({
				size: 16 * 4,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
			})
		return this.viewMatBuf
	}

	updateMatrixBuffers(device: GPUDevice): void {
		const projectionBuffer = this.getProjectionMatBuf(device)
		const viewBuffer = this.getViewMatBuf(device)
		this.updateMatrixWorld()
		const projectionMat = this.projectionMatrix
		const viewMat = this.matrixWorldInverse

		device.queue.writeBuffer(projectionBuffer, 0, new Float32Array(projectionMat.elements))
		device.queue.writeBuffer(viewBuffer, 0, new Float32Array(viewMat.elements))
	}
}

export default OrthographicCamera
