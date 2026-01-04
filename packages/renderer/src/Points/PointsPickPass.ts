import { ComputePass, ResourceProvider } from '../pass/Pass'
import Renderer from '../Renderer'
import Points from './Points'
import { getComputeShader } from '../material/shaders/pointsCompute'

export class PointsPickPass extends ComputePass {
	private points: Points
	private pickPipeline: GPUComputePipeline | undefined
	private pickBindGroup: GPUBindGroup | undefined
	private lastHasRadius: boolean | undefined

	constructor(points: Points) {
		super('PointsPickPass')
		this.points = points
	}

	execute(renderer: Renderer, encoder: GPUCommandEncoder): void {
		const device = renderer.device
		const backend = renderer.webgpuBackend
		const hasRadius = this.points.material.hasRadiusAttribute

		// 1. Get Pipeline
		// If hasRadius status changed, we need to recreate the pipeline or get the correct one
		if (!this.pickPipeline || this.lastHasRadius !== hasRadius) {
			const shaderCode = getComputeShader(hasRadius)
			this.pickPipeline = backend.getPipelineManager().getOrCreateComputePipeline({
				id: `points-picking-${hasRadius ? 'r' : 'u'}`,
				version: 1,
				options: {
					label: 'points-picking-pipeline',
					shaderCode,
					entryPoint: 'main',
				},
			})
			this.lastHasRadius = hasRadius
			// Reset bind group because layout might have changed (binding 3)
			this.pickBindGroup = undefined
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

		// Prepare BindGroup entries
		const entries = [
			{ binding: 0, resource: positionBuffer.GPUBuffer },
			{ binding: 1, resource: uniformGPUBuffer },
			{ binding: 2, resource: resultGPUBuffer },
		]

		if (hasRadius) {
			const radiusStorage = this.points.getRadiusStorage()
			if (radiusStorage && radiusStorage.buffer?.GPUBuffer) {
				entries.push({ binding: 3, resource: radiusStorage.buffer.GPUBuffer })
			} else {
				// Should not happen if hasRadiusAttribute is true, but safe guard
				console.warn('PointsPickPass: hasRadius is true but no radius buffer found')
			}
		}

		// We use BindGroupManager to handle caching and creation.
		// It will automatically create a new BindGroup if buffers change (different IDs).
		this.pickBindGroup = backend
			.getBindGroupManager()
			.createBindGroup(
				`points-picking-${hasRadius ? 'r' : 'u'}`,
				this.pickPipeline,
				`points-picking-${hasRadius ? 'r' : 'u'}`,
				1,
				0,
				entries
			)

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
