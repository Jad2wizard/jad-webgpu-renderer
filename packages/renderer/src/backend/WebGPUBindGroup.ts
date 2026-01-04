import { Camera } from '@renderer/camera/camera'
import Renderer from '@renderer/Renderer'
import { WebGPUBackend } from '@renderer/backend'
import Uniform from '@renderer/material/uniform'
import Storage from '@renderer/material/storage'

/**
 * BindGroup 条目配置接口
 */
export interface BindGroupEntryConfig {
	binding: number
	resource: GPUBindingResource
}

/**
 * 系统 Uniform 类型枚举
 */
export enum SystemUniformType {
	PROJECTION_MATRIX = 'projectionMatrix',
	VIEW_MATRIX = 'viewMatrix',
	RESOLUTION = 'resolution',
}

/**
 * WebGPU BindGroup 管理器
 * 负责统一管理 WebGPU BindGroup 的创建、配置和资源绑定
 */
export class WebGPUBindGroupManager {
	private device: GPUDevice
	private bindGroupCache = new Map<string, GPUBindGroup>()
	private bufferIdMap = new WeakMap<GPUBuffer, number>()
	private textureIdMap = new WeakMap<GPUTexture, number>()
	private nextResourceId = 1

	constructor(device: GPUDevice) {
		this.device = device
	}

	private getResourceId(resource: GPUBuffer | GPUTexture): number {
		let id =
			resource instanceof GPUBuffer
				? this.bufferIdMap.get(resource)
				: this.textureIdMap.get(resource)
		if (id === undefined) {
			id = this.nextResourceId++
			if (resource instanceof GPUBuffer) {
				this.bufferIdMap.set(resource, id)
			} else {
				this.textureIdMap.set(resource, id)
			}
		}
		return id
	}

	/**
	 * 获取系统 Uniform 的 Buffer
	 * @param uniformType 系统 Uniform 类型
	 * @param renderer 渲染器实例
	 * @param camera 相机实例
	 * @returns GPU Buffer 或 null
	 */
	private getSystemUniformBuffer(
		uniformType: SystemUniformType,
		renderer: Renderer,
		camera: Camera
	): GPUBuffer | null {
		switch (uniformType) {
			case SystemUniformType.PROJECTION_MATRIX:
				return camera.getProjectionMatBuf(this.device)
			case SystemUniformType.VIEW_MATRIX:
				return camera.getViewMatBuf(this.device)
			case SystemUniformType.RESOLUTION:
				return renderer.resolutionBuf
			default:
				return null
		}
	}

	/**
	 * 创建单个 BindGroup (通用方法)
	 * @param label 标签
	 * @param pipeline 管线
	 * @param pipelineId 管线ID
	 * @param pipelineVersion 管线版本
	 * @param groupIndex 绑定组索引
	 * @param entries 绑定条目列表
	 */
	createBindGroup(
		label: string,
		pipeline: GPURenderPipeline | GPUComputePipeline,
		pipelineId: string,
		pipelineVersion: number,
		groupIndex: number,
		entries: {
			binding: number
			resource: GPUBuffer | GPUTexture
			offset?: number
			size?: number
		}[]
	): GPUBindGroup {
		const layout = pipeline.getBindGroupLayout(groupIndex)

		const pendingEntries: {
			binding: number
			resource: GPUBindingResource
			cacheId: string
		}[] = []

		for (const entry of entries) {
			const { binding, resource, offset = 0, size } = entry

			let cacheId = ''
			let gpuResource: GPUBindingResource

			if (resource instanceof GPUBuffer) {
				const id = this.getResourceId(resource)
				// 如果未指定 size，则使用整个 buffer 大小减去 offset
				// 注意：这里简单取 resource.size 可能不准确（因为 createBindGroup 允许不传 size 表示剩余全部）
				// 但为了 cacheKey 唯一性，我们需要确定一个值。
				// 如果 size 为 undefined，在 GPUBindGroupEntry 中也不传 size。
				// CacheKey 中可以用 'rest' 或类似标记，或者如果 resource.size 可靠就用它。
				// WebGPU spec: if size is missing, use buffer.size - offset.
				const effectiveSize = size !== undefined ? size : resource.size - offset
				cacheId = `B:${id}@${offset}-${effectiveSize}`

				gpuResource = { buffer: resource, offset }
				if (size !== undefined) {
					// @ts-ignore
					gpuResource.size = size
				}
			} else {
				const id = this.getResourceId(resource)
				cacheId = `T:${id}`
				gpuResource = resource.createView()
			}

			pendingEntries.push({
				binding,
				resource: gpuResource,
				cacheId,
			})
		}

		// 按 binding 排序以确保 Key 的唯一性
		pendingEntries.sort((a, b) => a.binding - b.binding)

		const cacheKey =
			`${pipelineId}-v${pipelineVersion}-g${groupIndex}|` +
			pendingEntries.map((e) => `${e.binding}=${e.cacheId}`).join('|')

		let bindGroup = this.bindGroupCache.get(cacheKey)
		if (!bindGroup) {
			const descriptor: GPUBindGroupDescriptor = {
				label: `${label}-BindGroup-${groupIndex}`,
				layout,
				entries: pendingEntries.map((e) => ({
					binding: e.binding,
					resource: e.resource,
				})),
			}
			bindGroup = this.device.createBindGroup(descriptor)
			this.bindGroupCache.set(cacheKey, bindGroup)
		}

		return bindGroup
	}

	/**
	 * 为材质创建 BindGroups
	 * @param pipeline 渲染管线
	 * @param uniforms Uniform 变量映射
	 * @param storages Storage 变量映射
	 * @param textureInfos 纹理信息映射
	 * @param renderer 渲染器实例
	 * @param camera 相机实例
	 * @param backend WebGPU 后端实例
	 * @param textures 纹理资源映射
	 * @returns 包含绑定组数组和组索引列表的对象
	 */
	createMaterialBindGroups(
		label: string,
		pipeline: GPURenderPipeline,
		pipelineId: string,
		pipelineVersion: number,
		uniforms: Record<string, Uniform>,
		storages: Record<string, Storage>,
		textureInfos: Record<string, { group: number; binding: number }>,
		renderer: Renderer,
		camera: Camera,
		backend: WebGPUBackend,
		textures: Record<string, GPUTexture>
	): { bindGroups: GPUBindGroup[]; groupIndexList: number[] } {
		const bindGroups: GPUBindGroup[] = []

		const uniformGroupIndexs = Object.values(uniforms).map((u) => u.group)
		const storageGroupIndexs = Object.values(storages).map((u) => u.group)
		const textureGroupIndexs = Object.values(textureInfos).map((t) => t.group)

		const groupIndexList = Array.from(
			new Set([...uniformGroupIndexs, ...storageGroupIndexs, ...textureGroupIndexs])
		).sort((a, b) => a - b)

		// 遍历每个绑定组索引，为每个组创建对应的绑定组
		for (let index of groupIndexList) {
			const layout = pipeline.getBindGroupLayout(index)

			// 用于暂存条目和生成 Cache Key 的信息
			const pendingEntries: {
				binding: number
				resource: GPUBindingResource
				cacheId: string
			}[] = []

			// 处理uniform变量
			for (let un in uniforms) {
				const uniform = uniforms[un]
				// 跳过不属于当前组的uniform
				if (uniform.group !== index) continue

				let buffer: GPUBuffer | null = null

				// 处理特殊的系统uniform变量
				if (uniform.name === SystemUniformType.PROJECTION_MATRIX) {
					buffer = this.getSystemUniformBuffer(
						SystemUniformType.PROJECTION_MATRIX,
						renderer,
						camera
					)
				} else if (uniform.name === SystemUniformType.VIEW_MATRIX) {
					buffer = this.getSystemUniformBuffer(
						SystemUniformType.VIEW_MATRIX,
						renderer,
						camera
					)
				} else if (uniform.name === SystemUniformType.RESOLUTION) {
					buffer = this.getSystemUniformBuffer(
						SystemUniformType.RESOLUTION,
						renderer,
						camera
					)
				} else {
					// 处理自定义uniform变量
					if (uniform.needsUpdate) uniform.updateBuffer(backend)
					buffer = uniform.buffer?.GPUBuffer || null
				}

				if (!buffer) {
					throw new Error(
						`BindGroup(${label}) missing uniform buffer: ${uniform.name} (group=${uniform.group}, binding=${uniform.binding})`
					)
				}

				const resId = this.getResourceId(buffer)
				pendingEntries.push({
					binding: uniform.binding,
					resource: { buffer, offset: 0, size: uniform.size },
					cacheId: `B:${resId}@${uniform.size}`,
				})
			}

			// 处理storage变pendingEntries量
			for (let sn in storages) {
				const storage = storages[sn]
				// 跳过不属于当前组的storage
				if (storage.group !== index) continue
				// 如果需要更新，先更新缓冲区数据
				if (storage.needsUpdate) storage.updateBuffer(backend)
				const buffer = storage.buffer?.GPUBuffer
				if (!buffer) {
					throw new Error(
						`BindGroup(${label}) missing storage buffer: ${storage.name} (group=${storage.group}, binding=${storage.binding})`
					)
				}

				const resId = this.getResourceId(buffer)
				pendingEntries.push({
					binding: storage.binding,
					resource: { buffer, offset: 0, size: storage.size },
					cacheId: `B:${resId}@${storage.size}`,
				})
			}

			// 处理纹理资源
			for (let tn in textureInfos) {
				const { group, binding } = textureInfos[tn]
				// 跳过不属于当前组的纹理
				if (group !== index) continue
				const texture = textures[tn]
				if (!texture) {
					throw new Error(
						`BindGroup(${label}) missing texture: ${tn} (group=${group}, binding=${binding})`
					)
				}

				const resId = this.getResourceId(texture)
				pendingEntries.push({
					binding,
					resource: texture.createView(),
					cacheId: `T:${resId}`,
				})
			}

			// 按 binding 排序以确保 Key 的唯一性
			pendingEntries.sort((a, b) => a.binding - b.binding)

			const cacheKey =
				`${pipelineId}-v${pipelineVersion}-g${index}|` +
				pendingEntries.map((e) => `${e.binding}=${e.cacheId}`).join('|')

			// console.log(cacheKey)
			// 检查缓存
			let bindGroup = this.bindGroupCache.get(cacheKey)
			if (!bindGroup) {
				// 创建绑定组
				const descriptor: GPUBindGroupDescriptor = {
					label: label + `-BindGroup-${index}`,
					layout,
					entries: pendingEntries.map((entry) => ({
						binding: entry.binding,
						resource: entry.resource,
					})),
				}
				console.log(`创建 bindgroup${index}`)
				bindGroup = this.device.createBindGroup(descriptor)
				this.bindGroupCache.set(cacheKey, bindGroup)
			}

			bindGroups.push(bindGroup)
		}

		// 返回创建的绑定组数组和对应的组索引列表
		return { bindGroups, groupIndexList }
	}
}
