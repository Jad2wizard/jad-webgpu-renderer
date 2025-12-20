import Scene from './Scene'
import { Camera } from './camera/camera'
import { WebGPUBackend } from './backend'
import { RenderGraph } from './pass/RenderGraph'
import { ResourceProvider, ResourceHandle, Pass } from './pass/Pass'
import { ClearPass } from './pass/ClearPass'
import { ResolvePass } from './pass/ResolvePass'

type IProps = {
	canvas: HTMLCanvasElement
	antialias?: boolean
	clearColor?: [number, number, number, number]
	deviceLimits?: GPUDeviceDescriptor['requiredLimits']
}

class Renderer implements ResourceProvider {
	private ready = false
	private backend: WebGPUBackend
	private renderGraph: RenderGraph

	private constructor(props: IProps) {
		this.backend = new WebGPUBackend(props.canvas, props)
		this.renderGraph = new RenderGraph(this)
	}

	static async create(props: IProps): Promise<Renderer> {
		const instance = new Renderer(props)
		try {
			await instance.backend.init()
			instance.ready = true
			return instance
		} catch (e) {
			instance.ready = false
			throw 'WebGPU initialization failed' + e
		}
	}

	getResource(handle: ResourceHandle): GPUTexture | GPUBuffer | undefined {
		if (handle === 'output') {
			if (this.antialias) {
				return this.backend.getMultisampleTexture() || undefined
			}
			return this.backend.getContext().getCurrentTexture()
		}
		if (handle === 'screen') {
			return this.backend.getContext().getCurrentTexture()
		}
		return this.renderGraph.getResource(handle)
	}

	addResource(handle: ResourceHandle, resource: GPUTexture | GPUBuffer): void {
		this.renderGraph.addResource(handle, resource)
	}

	get width() {
		return this.backend.getWidth()
	}

	get height() {
		return this.backend.getHeight()
	}

	get device() {
		return this.backend.getDevice()
	}

	get presentationFormat() {
		return this.backend.getPresentationFormat()
	}

	get resolutionBuf() {
		return this.backend.getResolutionBuffer()
	}

	get antialias() {
		return this.backend.getAntialias()
	}

	get webgpuBackend() {
		return this.backend
	}

	get context() {
		return this.backend.getContext()
	}

	resize = () => {
		this.backend.resize()
	}

	/**
	 * 根据camera获取projectionMatrix和viewMatrix，遍历scene.children。
	 * 从children[i]中获取到geometry和material。从geometry中获取顶点数据，从material中获取渲染管线（包含着色器）
	 * 每个模型设置一次renderPass，最后统一提交到GPU
	 * @param camera
	 * @param scene
	 */
	public render(scene: Scene, camera: Camera) {
		if (!this.ready) {
			throw new Error('Renderer not initialized. Call create() first')
		}

		// 1. 更新全局变量
		this.backend.updateGlobalUniforms(camera)

		// 2. 准备渲染图
		this.renderGraph.clear()

		// 将全局资源注册到渲染图中
		const outputResource = this.getResource('output')
		if (outputResource) {
			this.renderGraph.addResource('output', outputResource)
		}
		const screenResource = this.getResource('screen')
		if (screenResource) {
			this.renderGraph.addResource('screen', screenResource)
		}

		// 3. 收集 Pass 并管理清除操作
		let outputLoadOp: GPULoadOp = 'clear'
		let hasOutputPass = false

		for (const model of scene.modelList) {
			if (model.visible) {
				const passes = model.getPasses(this, camera, outputLoadOp)
				// 检查是否有 Pass 写入 output
				const writesToOutput = passes.some((p) => p.outputs.has('output'))
				if (writesToOutput) {
					outputLoadOp = 'load' // 后续 Pass 应加载内容
					hasOutputPass = true
				}
				for (let p of passes) this.renderGraph.addPass(p)
			}
		}

		// 4. 如果没有绘制任何内容到 output，则使用 ClearPass 清屏
		if (!hasOutputPass) {
			this.renderGraph.addPass(new ClearPass('output', this.backend.getClearColor()))
		}

		// 5. 如果需要，执行 Resolve
		if (this.antialias) {
			// 添加 ResolvePass: output (MSAA) -> screen
			this.renderGraph.addPass(new ResolvePass('output', 'screen'))
		}

		// 6. 执行
		const encoder = this.device.createCommandEncoder()
		this.renderGraph.execute(encoder)
		this.device.queue.submit([encoder.finish()])
	}
}

export default Renderer
