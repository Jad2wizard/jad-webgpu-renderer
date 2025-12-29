import { Blending } from '../types'
import Renderer from '../Renderer'
import { hashString } from '../utils'

/**
 * WebGPU Pipeline 配置选WebGPUPipelineOptions项
 */
export interface WebGPUPipelineOptions {
	label: string
	shaderCode: string
	vertexEntry?: string
	fragmentEntry?: string
	computeEntry?: string
	vertexBufferLayouts: GPUVertexBufferLayout[]
	presentationFormat?: GPUTextureFormat
	blending?: Blending
	primitive?: GPUPrimitiveState
	multisampleCount?: number
	bindGroupLayoutDescriptors?: GPUBindGroupLayoutDescriptor[]
}

/**
 * Compute Pipeline 配置选项
 */
export interface WebGPUComputePipelineOptions {
	label: string
	shaderCode: string
	entryPoint?: string
	bindGroupLayoutDescriptors?: GPUBindGroupLayoutDescriptor[]
}

/**
 * Pipeline 请求参数，包含版本信息
 */
export interface PipelineRequest {
	id: string
	version: number
	options: WebGPUPipelineOptions
}

/**
 * Compute Pipeline 请求参数，包含版本信息
 */
export interface ComputePipelineRequest {
	id: string
	version: number
	options: WebGPUComputePipelineOptions
}

/**
 * WebGPU Pipeline 管理器
 * 负责统一管理 WebGPU Pipeline 的创建、配置和缓存
 */
export class WebGPUPipelineManager {
	private device: GPUDevice
	private pipelineCache = new Map<string, GPURenderPipeline | GPUComputePipeline>()
	private shaderModuleCache = new Map<string, GPUShaderModule>()

	constructor(device: GPUDevice) {
		this.device = device
	}

	private getOrCreateShaderModule(shaderCode: string, label: string): GPUShaderModule {
		const cacheKey = this.generateShaderCacheKey(shaderCode)

		if (this.shaderModuleCache.has(cacheKey)) {
			return this.shaderModuleCache.get(cacheKey)!
		}

		const shaderModule = this.device.createShaderModule({
			label: label,
			code: shaderCode,
		})

		this.shaderModuleCache.set(cacheKey, shaderModule)
		return shaderModule
	}

	private generateShaderCacheKey(shaderCode: string): string {
		return hashString(shaderCode)
	}

	private generatePipelineCacheKey(id: string, version: number): string {
		return `${id}-v${version}-render-pipeline`
	}

	private generateComputePipelineCacheKey(id: string, version: number): string {
		return `${id}-v${version}-compute-pipeline`
	}

	/**
	 * 清理指定ID的旧版本缓存
	 * @param id 管线ID
	 * @param currentVersion 当前版本
	 * @param type 管线类型 'render' | 'compute'
	 */
	private clearOldVersions(
		id: string,
		currentVersion: number,
		type: 'render' | 'compute' = 'render'
	): void {
		const keysToDelete: string[] = []
		const suffix = type === 'render' ? 'render-pipeline' : 'compute-pipeline'
		const regex = new RegExp(`^${id}-v(\\d+)-${suffix}$`)

		for (const key of this.pipelineCache.keys()) {
			// 匹配同一ID但不同版本的缓存键
			const match = key.match(regex)
			if (match) {
				const version = parseInt(match[1], 10)
				if (version < currentVersion) {
					keysToDelete.push(key)
				}
			}
		}

		// 删除旧版本缓存
		for (const key of keysToDelete) {
			this.pipelineCache.delete(key)
			console.log(`Cleared old ${type} pipeline cache: ${key}`)
		}
	}

	private configureBlending(blending: Blending): GPUBlendState | undefined {
		switch (blending) {
			// 正常混合模式：新像素与背景像素按透明度混合
			// 公式：result = src * 1 + dst * (1 - src.alpha)
			case 'normalBlending':
				return {
					color: {
						// 源颜色因子：使用完整的源颜色
						srcFactor: 'one',
						// 目标颜色因子：使用(1 - 源透明度)作为权重
						dstFactor: 'one-minus-src-alpha',
					},
					alpha: {
						// 源透明度因子：使用完整的源透明度
						srcFactor: 'one',
						// 目标透明度因子：使用(1 - 源透明度)作为权重
						dstFactor: 'one-minus-src-alpha',
					},
				}
			// 加法混合模式：新像素颜色直接叠加到背景上
			// 公式：result = src * 1 + dst * 1（颜色值相加）
			case 'additiveBlending':
				return {
					color: {
						// 源颜色因子：使用完整的源颜色
						srcFactor: 'one',
						// 目标颜色因子：使用完整的目标颜色
						dstFactor: 'one',
					},
					alpha: {
						// 源透明度因子：使用完整的源透明度
						srcFactor: 'one',
						// 目标透明度因子：使用完整的目标透明度
						dstFactor: 'one',
					},
				}
			// 最大值混合模式：取源像素和目标像素的最大值
			case 'max':
			// 最小值混合模式：取源像素和目标像素的最小值
			case 'min':
				return {
					color: {
						// 源颜色因子：使用完整的源颜色
						srcFactor: 'one',
						// 目标颜色因子：使用完整的目标颜色
						dstFactor: 'one',
						// 混合操作：使用指定的最大值或最小值操作
						operation: blending,
					},
					alpha: {
						// 源透明度因子：使用完整的源透明度
						srcFactor: 'one',
						// 目标透明度因子：使用完整的目标透明度
						dstFactor: 'one',
						// 透明度混合操作：使用指定的最大值或最小值操作
						operation: blending,
					},
				}
			// 无混合模式：不进行任何混合操作
			case 'none':
			default:
				// 返回undefined表示不使用混合
				return undefined
		}
	}

	getOrCreatePipeline(request: PipelineRequest, renderer: Renderer): GPURenderPipeline {
		const cacheKey = this.generatePipelineCacheKey(request.id, request.version)

		this.clearOldVersions(request.id, request.version, 'render')
		if (this.pipelineCache.has(cacheKey)) {
			return this.pipelineCache.get(cacheKey) as GPURenderPipeline
		}

		const options = request.options
		const shaderModule = this.getOrCreateShaderModule(options.shaderCode, options.label)
		const presentationFormat = options.presentationFormat || renderer.presentationFormat

		const pipelineDescriptor: GPURenderPipelineDescriptor = {
			label: cacheKey,
			layout: options.bindGroupLayoutDescriptors
				? this.device.createPipelineLayout({
						bindGroupLayouts: options.bindGroupLayoutDescriptors.map((d) =>
							this.device.createBindGroupLayout(d)
						),
					})
				: 'auto',
			vertex: {
				module: shaderModule,
				entryPoint: options.vertexEntry || 'vs',
				buffers: options.vertexBufferLayouts,
			},
			fragment: {
				module: shaderModule,
				entryPoint: options.fragmentEntry || 'fs',
				targets: [{ format: presentationFormat }],
			},
		}

		// 配置图元状态
		if (options.primitive) {
			pipelineDescriptor.primitive = options.primitive
		}

		// 配置混合模式
		if (options.blending && options.blending !== 'none') {
			const blendState = this.configureBlending(options.blending)
			if (blendState && pipelineDescriptor.fragment?.targets) {
				const targets = Array.from(pipelineDescriptor.fragment.targets)
				if (targets[0]) {
					;(targets[0] as GPUColorTargetState).blend = blendState
				}
			}
		}

		// 配置多重采样
		if (options.multisampleCount) {
			pipelineDescriptor.multisample = { count: options.multisampleCount }
		} else if (renderer.antialias) {
			pipelineDescriptor.multisample = { count: 4 }
		}

		const pipeline = this.device.createRenderPipeline(pipelineDescriptor)

		// 缓存管线
		this.pipelineCache.set(cacheKey, pipeline)

		return pipeline
	}

	/**
	 * 获取或创建 Compute Pipeline
	 */
	getOrCreateComputePipeline(request: ComputePipelineRequest): GPUComputePipeline {
		const { id, version, options } = request
		const cacheKey = this.generateComputePipelineCacheKey(id, version)

		// 清理同一ID的旧版本缓存
		this.clearOldVersions(id, version, 'compute')

		if (this.pipelineCache.has(cacheKey)) {
			return this.pipelineCache.get(cacheKey) as GPUComputePipeline
		}

		const shaderModule = this.getOrCreateShaderModule(options.shaderCode, options.label)

		const pipelineDescriptor: GPUComputePipelineDescriptor = {
			label: cacheKey,
			layout: options.bindGroupLayoutDescriptors
				? this.device.createPipelineLayout({
						bindGroupLayouts: options.bindGroupLayoutDescriptors.map((d) =>
							this.device.createBindGroupLayout(d)
						),
					})
				: 'auto',
			compute: {
				module: shaderModule,
				entryPoint: options.entryPoint || 'main',
			},
		}

		const pipeline = this.device.createComputePipeline(pipelineDescriptor)
		this.pipelineCache.set(cacheKey, pipeline)

		return pipeline
	}

	getBindGroupLayout(
		pipeline: GPURenderPipeline | GPUComputePipeline,
		index: number
	): GPUBindGroupLayout {
		return pipeline.getBindGroupLayout(index)
	}

	clearCache(): void {
		this.pipelineCache.clear()
		this.shaderModuleCache.clear()
	}

	getCacheStats(): {
		pipelineCount: number
		shaderModuleCount: number
	} {
		return {
			pipelineCount: this.pipelineCache.size,
			shaderModuleCount: this.shaderModuleCache.size,
		}
	}
}
