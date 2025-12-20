import { RenderPass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'
import { Camera } from '../camera/camera'
import Points from './Points'

export class PointsPass extends RenderPass {
	private points: Points
	private camera: Camera
	private outputResourceName: string
	private loadOp: GPULoadOp
	private clearValue: GPUColor

	constructor(
		points: Points,
		camera: Camera,
		outputResourceName: string,
		loadOp: GPULoadOp = 'load',
		clearValue: GPUColor = [0, 0, 0, 0]
	) {
		super('PointsPass')
		this.points = points
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
			.executePointsRenderPass(
				encoder,
				this.points,
				outputView,
				renderer,
				this.camera,
				this.loadOp,
				this.clearValue
			)
	}
}
