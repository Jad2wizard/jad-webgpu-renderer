import { RenderPass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'

export class ResolvePass extends RenderPass {
	private inputResourceName: string
	private outputResourceName: string

	constructor(inputResourceName: string, outputResourceName: string) {
		super('ResolvePass')
		this.inputResourceName = inputResourceName
		this.outputResourceName = outputResourceName
		this.read(inputResourceName)
		this.write(outputResourceName)
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void {
		const inputTexture = resources.getResource(this.inputResourceName) as GPUTexture
		const outputTexture = resources.getResource(this.outputResourceName) as GPUTexture

		if (!inputTexture || !outputTexture) {
			return
		}

		const passDesc: GPURenderPassDescriptor = {
			label: 'ResolvePass',
			colorAttachments: [
				{
					view: inputTexture.createView(),
					resolveTarget: outputTexture.createView(),
					loadOp: 'load',
					storeOp: 'discard', // Discard MSAA content after resolve
				},
			],
		}
		const pass = encoder.beginRenderPass(passDesc)
		pass.end()
	}
}
