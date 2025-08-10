export class WebGPUUtils {
	static async initWebGPU(
		canvas: HTMLCanvasElement,
		options?: {
			antiAlias?: boolean
			deviceLimits?: GPUDeviceDescriptor['requiredLimits']
		}
	): Promise<{ device: GPUDevice; context: GPUCanvasContext; format: GPUTextureFormat }> {
		const adapter = await navigator.gpu?.requestAdapter()
		const device = await adapter?.requestDevice({
			requiredLimits: {
				//设置单个buffer上限为800MB，略大于一亿个点的坐标Float32Array大小
				maxBufferSize: 800 * 1024 * 1024,
				maxStorageBufferBindingSize: 800 * 1024 * 1024,
				...options?.deviceLimits,
			},
		})
		if (!device) {
			throw 'your browser not supports WebGPU'
		}
		const canvasCtx = canvas.getContext('webgpu')
		if (!canvasCtx) {
			throw 'your browser not supports WebGPU'
		}
		const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		canvasCtx.configure({
			device,
			format: presentationFormat,
			alphaMode: 'premultiplied',
		})
		return {
			device,
			context: canvasCtx,
			format: presentationFormat,
		}
	}
}
