import { Camera } from '@/camera/camera'
import Renderer from '@/Renderer'
import { WebGPUBackend } from '@/backend'
import Uniform from '@/material/uniform'
import Storage from '@/material/storage'

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

	constructor(device: GPUDevice) {
		this.device = device
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
		uniforms: Record<string, Uniform>,
		storages: Record<string, Storage>,
		textureInfos: Record<string, { group: number; binding: number }>,
		renderer: Renderer,
		camera: Camera,
		backend: WebGPUBackend,
		textures: Record<string, GPUTexture>
	): { bindGroups: GPUBindGroup[]; groupIndexList: number[] } {
		const bindGroups: GPUBindGroup[] = []

		// 收集所有uniform变量的组索引
		const uniformGroupIndexs = Object.values(uniforms).map((u) => u.group)
		// 收集所有storage变量的组索引
		const storageGroupIndexs = Object.values(storages).map((u) => u.group)

		// 合并并去重所有组索引，确保每个组只处理一次
		const groupIndexList = Array.from(new Set([...uniformGroupIndexs, ...storageGroupIndexs]))

		// 遍历每个绑定组索引，为每个组创建对应的绑定组
		for (let index of groupIndexList) {
			const entries: BindGroupEntryConfig[] = []

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

				if (buffer) {
					entries.push({
						binding: uniform.binding,
						resource: { buffer, offset: 0, size: uniform.size },
					})
				}
			}

			// 处理storage变量
			for (let sn in storages) {
				const storage = storages[sn]
				// 跳过不属于当前组的storage
				if (storage.group !== index) continue
				// 如果需要更新，先更新缓冲区数据
				if (storage.needsUpdate) storage.updateBuffer(backend)
				const buffer = storage.buffer?.GPUBuffer
				if (buffer) {
					entries.push({
						binding: storage.binding,
						resource: { buffer, offset: 0, size: storage.size },
					})
				}
			}

			// 处理纹理资源
			for (let tn in textureInfos) {
				const { group, binding } = textureInfos[tn]
				// 跳过不属于当前组的纹理
				if (group !== index) continue
				const texture = textures[tn]
				// 跳过未提供的纹理
				if (!texture) continue
				// 创建纹理条目并添加到绑定条目
				entries.push({ binding, resource: texture.createView() })
			}

			// 创建绑定组
			const descriptor: GPUBindGroupDescriptor = {
				label: label + `-BindGroup-${index}`,
				layout: pipeline.getBindGroupLayout(index),
				entries: entries.map((entry) => ({
					binding: entry.binding,
					resource: entry.resource,
				})),
			}
			const bindGroup = this.device.createBindGroup(descriptor)
			bindGroups.push(bindGroup)
		}

		// 返回创建的绑定组数组和对应的组索引列表
		return { bindGroups, groupIndexList }
	}
}
