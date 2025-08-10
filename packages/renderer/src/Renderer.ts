import Scene from './Scene'
import { Camera } from './camera/camera'
import { WebGPUBackend } from './backend'

type IProps = {
	canvas: HTMLCanvasElement
	antialias?: boolean
	clearColor?: [number, number, number, number]
	deviceLimits?: GPUDeviceDescriptor['requiredLimits']
}

class Renderer {
	private ready = false
	private backend: WebGPUBackend

	private constructor(props: IProps) {
		this.backend = new WebGPUBackend(props.canvas, props)
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
		this.backend.render(scene, camera, this)
	}
}

export default Renderer
