import { Color } from '@renderer/types'
import { normalizeColor } from '@renderer/utils'
import { WebGPUUtils } from './backend/WebGPUUtils'
import Scene from './Scene'
import { Camera } from './camera/camera'
import { WebGPUBackend } from './backend'
import { RenderGraph } from './pass/RenderGraph'
import { ClearPass } from './pass/ClearPass'
import { ResolvePass } from './pass/ResolvePass'

type IProps = {
	canvas: HTMLCanvasElement
	antialias?: boolean
	clearColor?: [number, number, number, number]
	deviceLimits?: GPUDeviceDescriptor['requiredLimits']
}

class Renderer {
	private ready = false
	private backend: WebGPUBackend
	private renderGraph: RenderGraph
	private multisampleTexture: GPUTexture | null = null
	private _resolutionBuf: GPUBuffer

	private _device: GPUDevice
	private _context: GPUCanvasContext
	private _format: GPUTextureFormat
	private _canvas: HTMLCanvasElement
	private _clearColor: Color = [0, 0, 0, 0] as Color
	private _antialias: boolean = false

	private constructor(props: IProps) {
		this._canvas = props.canvas
		if (props.antialias !== undefined) this._antialias = props.antialias
		if (props.clearColor !== undefined) this._clearColor = normalizeColor(props.clearColor)
	}

	static async create(props: IProps): Promise<Renderer> {
		//使用 webgpuutils 初始化 device
		const { device, context, format } = await WebGPUUtils.initWebGPU(props.canvas, {
			antiAlias: props.antialias,
			deviceLimits: props.deviceLimits,
		})

		context.configure({
			device,
			format,
			alphaMode: 'premultiplied', // 确保透明度正确处理，输出到 canvas 上的颜色在 fragment shader中已经预乘过 alpha 值。浏览器合成器在混合 canvas 与网页背景时就不会再对 alpha 进行处理。
		})

		const instance = new Renderer(props)
		instance._device = device
		instance._context = context
		instance._format = format
		instance.backend = new WebGPUBackend(device)
		instance.renderGraph = new RenderGraph(instance)

		try {
			instance._resolutionBuf = instance._device.createBuffer({
				size: 2 * 4, //vec2f
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
				label: 'resolution buffer',
			})
			instance.ready = true
			instance.resize()
			return instance
		} catch (e) {
			instance.ready = false
			throw 'WebGPU initialization failed' + e
		}
	}

	get width() {
		return this._canvas.width
	}

	get height() {
		return this._canvas.height
	}

	get device() {
		return this._device
	}

	get presentationFormat() {
		return this._format
	}

	get resolutionBuf() {
		return this._resolutionBuf
	}

	get antialias() {
		return this._antialias
	}

	get clearColor() {
		return this._clearColor
	}

	get webgpuBackend() {
		return this.backend
	}

	get context() {
		return this._context
	}

	resize = () => {
		this._canvas.width = this._canvas.offsetWidth
		this._canvas.height = this._canvas.offsetHeight
		this.updateResolution()
		if (this._antialias) {
			this.updateMultisampleTexture()
		}
	}

	private updateResolution() {
		const resolution = new Float32Array([this.width, this.height])
		this._device.queue.writeBuffer(this._resolutionBuf, 0, resolution)
	}

	private updateMultisampleTexture() {
		if (this.multisampleTexture) this.multisampleTexture.destroy()
		const textureFactory = this.backend.getTextureFactory()
		this.multisampleTexture = textureFactory.createMultisampleTexture(
			this.width,
			this.height,
			this.presentationFormat
		)
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

		camera.updateMatrixBuffers(this._device)

		this.renderGraph.clear()

		// 将全局资源注册到渲染图中
		const outputResource = this._antialias
			? this.multisampleTexture || undefined
			: this._context.getCurrentTexture()

		if (outputResource) {
			this.renderGraph.addResource('output', outputResource)
		}
		const screenResource = this._context.getCurrentTexture()
		if (screenResource) {
			this.renderGraph.addResource('screen', screenResource)
		}

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

		// 如果没有绘制任何内容到 output，则使用 ClearPass 清屏
		if (!hasOutputPass) {
			this.renderGraph.addPass(new ClearPass('output', this._clearColor))
		}

		if (this.antialias) {
			// 添加 ResolvePass: output (MSAA) -> screen
			this.renderGraph.addPass(new ResolvePass('output', 'screen'))
		}

		const encoder = this.device.createCommandEncoder()
		this.renderGraph.execute(encoder)
		this.device.queue.submit([encoder.finish()])
	}
}

export default Renderer
