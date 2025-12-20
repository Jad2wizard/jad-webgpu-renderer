import { RenderPass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'
import Model from '../Model'
import { Camera } from '../camera/camera'

export class HeatPointsPass extends RenderPass {
	private model: Model
	private camera: Camera
	private outputTextureName: string

	constructor(model: Model, camera: Camera, outputTextureName: string) {
		super('HeatPointsPass')
		this.model = model
		this.camera = camera
		this.outputTextureName = outputTextureName
		this.write(outputTextureName)
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void {
		const heatValTexture = resources.getResource(this.outputTextureName) as GPUTexture
		if (!heatValTexture) {
			throw new Error(`Resource ${this.outputTextureName} not found`)
		}
		const backend = renderer.webgpuBackend
		backend
			.getRenderPassManager()
			.executeHeatPointsRenderPass(encoder, this.model, heatValTexture, renderer, this.camera)
	}
}

export class MaxHeatValuePass extends RenderPass {
	private model: Model
	private camera: Camera
	private inputTextureName: string
	private outputTextureName: string

	constructor(model: Model, camera: Camera, inputTextureName: string, outputTextureName: string) {
		super('MaxHeatValuePass')
		this.model = model
		this.camera = camera
		this.inputTextureName = inputTextureName
		this.outputTextureName = outputTextureName
		this.read(inputTextureName)
		this.write(outputTextureName)
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void {
		const maxHeatValTexture = resources.getResource(this.outputTextureName) as GPUTexture
		const heatValTexture = resources.getResource(this.inputTextureName) as GPUTexture

		if (!maxHeatValTexture) {
			throw new Error(`Resource ${this.outputTextureName} not found`)
		}
		if (!heatValTexture) {
			throw new Error(`Resource ${this.inputTextureName} not found`)
		}
		const extraTextures: Record<string, GPUTexture> = {
			heatValTex: heatValTexture,
		}
		const backend = renderer.webgpuBackend
		backend
			.getRenderPassManager()
			.executeMaxHeatValueRenderPass(
				encoder,
				this.model,
				maxHeatValTexture,
				renderer,
				this.camera,
				extraTextures
			)
	}
}
