import Scene from './Scene'
import { Camera } from './camera/camera'

type IProps = {
	canvas: HTMLCanvasElement
	antiAlias?: boolean
	clearColor?: [number, number, number, number]
	deviceLimits?: GPUDeviceDescriptor['requiredLimits']
}

const delay = (t = 1000) => new Promise((resolve) => setTimeout(resolve, t))

class Renderer {
	private outputCanvas: HTMLCanvasElement
	private canvasCtx: GPUCanvasContext | null
	private renderPassDescriptor: GPURenderPassDescriptor
	private clearColor = [0, 0, 0, 0]
	private _ready = false
	private _multisampleTexture: GPUTexture | null
	private _antialias: boolean

	public device: GPUDevice
	public presentationFormat: GPUTextureFormat

	resolutionBuf: GPUBuffer

	constructor(props: IProps) {
		this.outputCanvas = props.canvas
		this.outputCanvas.width = this.outputCanvas.offsetWidth
		this.outputCanvas.height = this.outputCanvas.offsetHeight
		this.canvasCtx = this.outputCanvas.getContext('webgpu') || null
		this._antialias = props.antiAlias || false
		this._multisampleTexture = null
		if (this._antialias) {
			this.createMultisampleTexture()
		}
		if (!this.canvasCtx) {
			throw 'your browser not supports WebGPU'
		}
		if (props.clearColor) this.clearColor = props.clearColor.slice()

		this.initWebGPU(props)
	}

	private async initWebGPU(props: IProps) {
		const adapter = await navigator.gpu?.requestAdapter()
		const device = await adapter?.requestDevice({
			requiredLimits: {
				//设置单个buffer上限为800MB，略大于一亿个点的坐标Float32Array大小
				maxBufferSize: 800 * 1024 * 1024,
				maxStorageBufferBindingSize: 800 * 1024 * 1024,
				...props.deviceLimits,
			},
		})
		if (!device) {
			throw 'your browser not supports WebGPU'
		}
		this.device = device
		//@ts-ignore
		window.r = this
		if (!this.canvasCtx) {
			throw 'your browser not supports WebGPU'
		}
		this.presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		this.canvasCtx.configure({
			device,
			format: this.presentationFormat,
			alphaMode: 'premultiplied',
		})
		this.renderPassDescriptor = {
			label: 'render pass',
			colorAttachments: [
				{
					view: this.canvasCtx.getCurrentTexture().createView(),
					clearValue: this.clearColor,
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
		}
		this.resolutionBuf = device.createBuffer({
			size: 2 * 4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		})
		this._ready = true
		this.resize()
		if (this._antialias) this.createMultisampleTexture()
	}

	get ready() {
		return this._ready
	}

	get width() {
		return this.outputCanvas.width
	}

	get height() {
		return this.outputCanvas.height
	}

	get antialias() {
		return this._antialias
	}

	set antialias(v: boolean) {
		this._antialias = v
		if (v) this.createMultisampleTexture()
		else if (this._multisampleTexture) this._multisampleTexture.destroy()
	}

	private updateRenderPassDescriptor(renderTarget?: GPUTexture) {
		if (!this.canvasCtx) return
		const colorAttachment = (this.renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0]
		if (!renderTarget) {
			if (!this._antialias) {
				colorAttachment.view = this.canvasCtx.getCurrentTexture().createView()
				colorAttachment.resolveTarget = undefined
			} else if (this._multisampleTexture) {
				colorAttachment.view = this._multisampleTexture?.createView()
				colorAttachment.resolveTarget = this.canvasCtx.getCurrentTexture().createView()
			}
		} else {
			colorAttachment.view = renderTarget.createView()
			colorAttachment.resolveTarget = undefined
		}
	}

	/**
	 * 根据camera获取projectionMatrix和viewMatrix，遍历scene.children。
	 * 从children[i]中获取到geometry和material。从geometry中获取顶点数据，从material中获取渲染管线（包含着色器）
	 * 每个模型设置一次renderPass，最后统一提交到GPU
	 * @param camera
	 * @param scene
	 */
	public async render(scene: Scene, camera: Camera) {
		let wait = 0
		while (!this.ready) {
			await delay(20)
			wait += 20
			if (wait > 2000) {
				throw 'WebGPU初始化失败'
			}
		}

		// const s = new Date().valueOf()
		if (!this.device || !this.canvasCtx) return
		camera.updateMatrixBuffers(this.device)
		const { device, renderPassDescriptor } = this

		this.updateRenderPassDescriptor()

		const encoder = device.createCommandEncoder()

		for (let model of scene.modelList) {
			model.prevRender(this, encoder, camera)
		}

		const pass = encoder.beginRenderPass(renderPassDescriptor)
		for (let model of scene.modelList) {
			if (model.visible) model.render(this, pass, camera)
		}

		pass.end()

		const commandBuffer = encoder.finish()
		this.device.queue.submit([commandBuffer])

		// await this.device.queue.onSubmittedWorkDone()
		// for (let model of scene.modelList) {
		// 	if (model instanceof Heatmap) {
		// 		await delay(50)
		// 		await model.setMaxMinHeatValue(this, 'max')
		// 		await model.setMaxMinHeatValue(this, 'min')
		// 	}
		// }
		// console.log(new Date().valueOf() - s)
	}

	resize = () => {
		if (!this.ready || !this.device) return
		this.outputCanvas.width = this.outputCanvas.offsetWidth
		this.outputCanvas.height = this.outputCanvas.offsetHeight
		this.device.queue.writeBuffer(this.resolutionBuf, 0, new Float32Array([this.width, this.height]))
		if (this._antialias) this.createMultisampleTexture()
	}

	private createMultisampleTexture() {
		if (!this.canvasCtx || !this.device) return
		if (this._multisampleTexture) this._multisampleTexture.destroy()
		const outputCanvavTexture = this.canvasCtx.getCurrentTexture()
		this._multisampleTexture = this.device.createTexture({
			format: outputCanvavTexture.format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
			size: [outputCanvavTexture.width, outputCanvavTexture.height],
			sampleCount: 4, //MSAA webgpu只支持采样率为1或者4的多重采样
		})
	}
}

export default Renderer
