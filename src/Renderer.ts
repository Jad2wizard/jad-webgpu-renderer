import {OrthographicCamera, PerspectiveCamera} from 'three'
import Scene from './Scene'

type IProps = {
	canvas: HTMLCanvasElement
	clearColor?: [number, number, number, number]
}

class Renderer {
	private outputCanvas: HTMLCanvasElement
	private device: GPUDevice
	private canvasCtx: GPUCanvasContext | null
	private renderPassDescriptor: GPURenderPassDescriptor

	constructor(props: IProps) {
		this.outputCanvas = props.canvas
		this.canvasCtx = this.outputCanvas.getContext('webgpu') || null
		if (!this.canvasCtx) {
			throw 'your browser not supports WebGPU'
		}
		this.initWebGPU()
		this.renderPassDescriptor = {
			label: 'render pass',
			colorAttachments: [
				{
					view: this.canvasCtx.getCurrentTexture().createView(),
					clearValue: props.clearColor ? props.clearColor.slice() : [0, 0, 0, 0],
					loadOp: 'clear',
					storeOp: 'store'
				}
			]
		}
	}

	get width() {
		return this.outputCanvas.width
	}

	get height() {
		return this.outputCanvas.height
	}

	/**
	 * 根据camera获取projectionMatrix和viewMatrix，遍历scene.children。
	 * 从children[i]中获取到geometry和material。从geometry中获取顶点数据，从material中获取渲染管线（包含着色器）
	 * 每个模型设置一次renderPass，最后统一提交到GPU
	 * @param camera
	 * @param scene
	 */
	public render(camera: PerspectiveCamera | OrthographicCamera, scene: Scene) {
		if (!this.device || !this.canvasCtx) return
		const {device, canvasCtx, renderPassDescriptor} = this
		const projectionMat = camera.projectionMatrix
		const viewMat = camera.matrixWorldInverse

		//@ts-ignore
		renderPassDescriptor.colorAttachments[0].view = canvasCtx.getCurrentTexture().createView()
		const encoder = device.createCommandEncoder()
		const pass = encoder.beginRenderPass(renderPassDescriptor)
	}

	public resize(width: number, height: number) {}

	private async initWebGPU() {
		const adapter = await navigator.gpu?.requestAdapter()
		const device = await adapter?.requestDevice()
		if (!device) {
			throw 'your browser not supports WebGPU'
		}
		this.device = device
		if (!this.canvasCtx) {
			throw 'your browser not supports WebGPU'
		}
		const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		this.canvasCtx.configure({
			device,
			format: presentationFormat
			//alphaMode: 'premultiplied'
		})
	}
}

export default Renderer
