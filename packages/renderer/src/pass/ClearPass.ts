import { RenderPass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'

export class ClearPass extends RenderPass {
	private outputResourceName: string
	private clearValue: GPUColor

	constructor(outputResourceName: string, clearValue: GPUColor) {
		super('ClearPass')
		this.outputResourceName = outputResourceName
		this.clearValue = clearValue
		this.write(outputResourceName)
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder, resources: ResourceProvider): void {
		const outputTexture = resources.getResource(this.outputResourceName) as GPUTexture
		if (!outputTexture) {
			// If output is screen, it might be dynamic, so we check again or throw
			// In Renderer implementation, 'output' returns current texture
			// But if it's not found (e.g. context lost), we skip
			return
		}
		const outputView = outputTexture.createView()

		const passDesc: GPURenderPassDescriptor = {
			label: 'ClearPass',
			colorAttachments: [
				{
					view: outputView,
					clearValue: this.clearValue,
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
		}
		const pass = encoder.beginRenderPass(passDesc)
		pass.end()
	}
}
