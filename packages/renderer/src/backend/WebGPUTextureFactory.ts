import type Renderer from '../Renderer'

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
	 * 创建热力图值纹理
	 * @param width 纹理宽度
	 * @param height 纹理高度
	 * @returns GPUTexture
	 */
	createHeatValueTexture(width: number, height: number): GPUTexture {
		return this.device.createTexture({
			size: [width, height, 1],
			format: 'rgba16float', // 因为需要使用纹理的 R 通道存放像素的热力值，故需要选择高精度的浮点数格式，而 rgba32float 又不支持multisample。
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		})
	}

	/**
	 * 创建最大热力值纹理
	 * @returns GPUTexture
	 */
	createMaxHeatValueTexture(): GPUTexture {
		return this.device.createTexture({
			size: [1, 1, 1],
			format: 'rgba16float',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		})
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
	 * 创建渲染通道描述符
	 * @param label 标签
	 * @param texture 目标纹理
	 * @param clearColor 清除颜色
	 * @returns GPURenderPassDescriptor
	 */
	createRenderPassDescriptor(
		label: string,
		texture: GPUTexture,
		clearColor: GPUColor = [0, 0, 0, 0]
	): GPURenderPassDescriptor {
		return {
			label,
			colorAttachments: [
				{
					view: texture.createView(),
					clearValue: clearColor,
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
		}
	}

	/**
	 * 创建多重采样纹理
	 * @param width 宽度
	 * @param height 高度
	 * @param format 格式
	 * @param sampleCount 采样数
	 * @returns GPUTexture
	 */
	createMultisampleTexture(
		width: number,
		height: number,
		format: GPUTextureFormat,
		sampleCount: number = 4
	): GPUTexture {
		return this.device.createTexture({
			format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
			size: [width, height],
			sampleCount,
		})
	}
}
