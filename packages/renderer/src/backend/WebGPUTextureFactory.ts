/**
 * WebGPU 纹理工厂
 * 负责创建各种类型的纹理
 */
export class WebGPUTextureFactory {
	private device: GPUDevice

	constructor(device: GPUDevice) {
		this.device = device
	}

	/**
	 * 创建通用纹理
	 * @param options 纹理创建选项
	 * @returns GPUTexture
	 */
	createTexture(options: GPUTextureDescriptor): GPUTexture {
		return this.device.createTexture(options)
	}

	/**
	 * 创建多重采样纹理
	 * @param width 宽度
	 * @param height 高度
	 * @param format 格式
	 * @returns GPUTexture
	 */
	createMultisampleTexture(width: number, height: number, format: GPUTextureFormat): GPUTexture {
		return this.device.createTexture({
			format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
			size: [width, height],
			sampleCount: 4,
		})
	}
}
