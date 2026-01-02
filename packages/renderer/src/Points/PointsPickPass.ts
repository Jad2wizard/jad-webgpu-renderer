import { ComputePass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'
import Points from './Points'
import { computeShader } from '../material/shaders/pointsCompute'

export class PointsPickPass extends ComputePass {
	private points: Points
	private pickPipeline: GPUComputePipeline | undefined
	private pickBindGroup: GPUBindGroup | undefined

	constructor(points: Points) {
		super('PointsPickPass')
		this.points = points
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder): void {
		const device = renderer.device
		const backend = renderer.webgpuBackend

		// 1. Get Pipeline
		if (!this.pickPipeline) {
			this.pickPipeline = backend.getPipelineManager().getOrCreateComputePipeline({
				id: 'points-picking',
				version: 1,
				options: {
					label: 'points-picking-pipeline',
					shaderCode: computeShader,
					entryPoint: 'main',
				},
			})
		}

		const positionAttr = this.points.geometry.getAttribute('position')
		const pickUniform = this.points.getPickUniform()
		const pickResultStorage = this.points.getPickResultStorage()

		if (!positionAttr || !pickUniform || !pickResultStorage) return

		const positionBuffer = positionAttr.buffer
		const uniformGPUBuffer = pickUniform.buffer?.GPUBuffer
		const resultGPUBuffer = pickResultStorage.buffer?.GPUBuffer

		if (!positionBuffer || !positionBuffer.GPUBuffer || !uniformGPUBuffer || !resultGPUBuffer)
			return

		// We should recreate BindGroup if buffers changed (e.g. resized).
		// For simplicity, we assume if we have a bindgroup, it's valid unless explicitly invalidated.
		// However, if buffers are re-allocated, the old bindgroup points to destroyed buffers.
		// Points.ts reallocate() clears pickBindGroup. We need a way to know if we need to recreate it.
		// We can check if cached bindgroup is valid? No easy way.
		// We can rely on Points clearing this.pickBindGroup when reallocating.
		// So PointsPickPass should expose a method to clear bindgroup?
		// Or PointsPickPass checks if buffers match what it expects?

		if (!this.pickBindGroup) {
			this.pickBindGroup = device.createBindGroup({
				layout: this.pickPipeline.getBindGroupLayout(0),
				entries: [
					{ binding: 0, resource: { buffer: positionBuffer.GPUBuffer } },
					{ binding: 1, resource: { buffer: uniformGPUBuffer } },
					{ binding: 2, resource: { buffer: resultGPUBuffer } },
				],
			})
		}

		// 3. Dispatch
		const pass = encoder.beginComputePass()
		pass.setPipeline(this.pickPipeline)
		pass.setBindGroup(0, this.pickBindGroup)
		pass.dispatchWorkgroups(Math.ceil(this.points.total / 64))
		pass.end()
	}

	public resetBindGroup() {
		this.pickBindGroup = undefined
	}
}
