import { RenderPass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'
import { Camera } from '../camera/camera'
import { Paths } from './Paths'

export class PathsPass extends RenderPass {
	private paths: Paths
	private camera: Camera
	private outputResourceName: string
	private loadOp: GPULoadOp
	private clearValue: GPUColor

	constructor(
		paths: Paths,
		camera: Camera,
		outputResourceName: string,
		loadOp: GPULoadOp = 'load',
		clearValue: GPUColor = [0, 0, 0, 0]
	) {
		super('PathsPass')
		this.paths = paths
		this.camera = camera
		this.outputResourceName = outputResourceName
		this.loadOp = loadOp
		this.clearValue = clearValue
		this.write(outputResourceName)
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void {
		const outputTexture = resources.getResource(this.outputResourceName) as GPUTexture
		if (!outputTexture) {
			throw new Error(`Resource ${this.outputResourceName} not found`)
		}
		const outputView = outputTexture.createView()

		const backend = renderer.webgpuBackend
		backend
			.getRenderPassManager()
			.executePathsRenderPass(
				encoder,
				this.paths,
				outputView,
				renderer,
				this.camera,
				this.loadOp,
				this.clearValue
			)
	}
}
