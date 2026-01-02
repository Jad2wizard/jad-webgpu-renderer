import { RenderPass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'
import Heatmap from './Heatmap'
import Model from '../Model'
import { Camera } from '../camera/camera'

export class HeatPointsPass extends RenderPass {
	private model: Model
	private camera: Camera
	private outputTexture: GPUTexture

	constructor(model: Model, camera: Camera, outputTexture: GPUTexture) {
		super('HeatPointsPass')
		this.model = model
		this.camera = camera
		this.outputTexture = outputTexture
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void {
		const heatValTexture = this.outputTexture

		const heatRenderPassDesc = RenderPass.createRenderPassDescriptor(
			'heat point renderPass',
			heatValTexture,
			[0, 0, 0, 0],
			'clear',
			'store'
		)
		const pass = encoder.beginRenderPass(heatRenderPassDesc)
		this.model.render(renderer, pass, this.camera)
		pass.end()
	}
}

export class MaxHeatValuePass extends RenderPass {
	private model: Model
	private camera: Camera
	private inputTexture: GPUTexture
	private outputTexture: GPUTexture

	constructor(model: Model, camera: Camera, inputTexture: GPUTexture, outputTexture: GPUTexture) {
		super('MaxHeatValuePass')
		this.model = model
		this.camera = camera
		this.inputTexture = inputTexture
		this.outputTexture = outputTexture
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void {
		const maxHeatValTexture = this.outputTexture
		const heatValTexture = this.inputTexture

		const extraTextures: Record<string, GPUTexture> = {
			heatValTex: heatValTexture,
		}

		const renderPassDesc = RenderPass.createRenderPassDescriptor(
			'max heat renderPass',
			maxHeatValTexture,
			[0, 0, 0, 0],
			'clear',
			'store'
		)
		const pass = encoder.beginRenderPass(renderPassDesc)
		this.model.render(renderer, pass, this.camera, extraTextures)
		pass.end()
	}
}

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
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void {
		const outputTexture = resources.getResource(this.outputResourceName) as GPUTexture
		if (!outputTexture) {
			throw new Error(`Resource ${this.outputResourceName} not found`)
		}

		const passDesc = RenderPass.createRenderPassDescriptor(
			'heatmap renderPass',
			outputTexture,
			this.clearValue,
			this.loadOp,
			'store'
		)
		const pass = encoder.beginRenderPass(passDesc)
		this.heatmap.render(renderer, pass, this.camera)
		pass.end()
	}
}
