import {OrthographicCamera, PerspectiveCamera} from 'three'
import {Scene} from '../Scene'

type IProps = {
	canvas: HTMLCanvasElement
}

class Renderer {
	private outputCanvas: HTMLCanvasElement
	private device: GPUDevice

	constructor(props: IProps) {
		this.outputCanvas = props.canvas
		this.initWebGPU()
	}

	/**
	 * 根据camera获取projectionMatrix和viewMatrix，遍历scene.children。
	 * 从children[i]中获取到geometry和material。从geometry中获取顶点数据，从material中获取渲染管线（包含着色器）
	 * 每个模型设置一次renderPass，最后统一提交到GPU
	 * @param camera
	 * @param scene
	 */
	public render(camera: PerspectiveCamera | OrthographicCamera, scene: Scene) {}

	public resize(width: number, height: number) {}

	private async initWebGPU() {
		const adapter = await navigator.gpu?.requestAdapter()
		const device = await adapter?.requestDevice()
		if (!device) {
			throw 'your browser not supports WebGPU'
		}
		this.device = device
		const context = this.outputCanvas.getContext('webgpu')
		const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
		context?.configure({
			device,
			format: presentationFormat
		})
	}
}

export default Renderer
