import { RenderPass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'
import { Camera } from '../camera/camera'
import Heatmap from './Heatmap'

export class HeatmapRenderPass extends RenderPass {
	private heatmap: Heatmap
	private camera: Camera
	private outputResourceName: string
	private loadOp: GPULoadOp
	private clearValue: GPUColor

	constructor(
		heatmap: Heatmap,
		camera: Camera,
		outputResourceName: string,
		loadOp: GPULoadOp = 'load',
		clearValue: GPUColor = [0, 0, 0, 0]
	) {
		super('HeatmapRenderPass')
		this.heatmap = heatmap
		this.camera = camera
		this.outputResourceName = outputResourceName
		this.loadOp = loadOp
		this.clearValue = clearValue
		this.write(outputResourceName)
		// Heatmap depends on heatValTex and maxValTex, but these are internal to Heatmap model logic mostly.
		// However, if we want to be explicit in graph:
		this.read('heatValTex')
		this.read('maxValTex')
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
			.executeHeatmapRenderPass(
				encoder,
				this.heatmap,
				outputView,
				renderer,
				this.camera,
				this.loadOp,
				this.clearValue
			)
	}
}
