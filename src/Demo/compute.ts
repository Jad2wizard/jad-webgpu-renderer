/* eslint-disable no-undef */
//code from webgpu-fundamentals
export async function main(canvas: HTMLCanvasElement) {
	const adapter = await navigator.gpu?.requestAdapter()
	const device = await adapter?.requestDevice()
	if (!device) {
		throw 'need a browser that supports WebGPU'
	}

	const module = device.createShaderModule({
		label: 'doubling compute module',
		code: `
			@group(0) @binding(1) var<storage, read_write> data: array<f32>;

			@compute @workgroup_size(1) fn computeSomething(
				@builtin(global_invocation_id) id: vec3<u32>
			) {
				let i = id.y;
				data[i] = data[i] * 2;
			}
		`
	})

	const pipeline = device.createComputePipeline({
		label: 'doubling compute pipeline',
		layout: 'auto',
		compute: {
			module,
			entryPoint: 'computeSomething'
		}
	})

	const input = new Float32Array([1, 3, 5])

	const workBuffer = device.createBuffer({
		label: 'work buffer',
		size: input.byteLength,
		// eslint-disable-next-line no-undef
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
	})

	device.queue.writeBuffer(workBuffer, 0, input)

	const resultBuffer = device.createBuffer({
		label: 'result buffer',
		size: input.byteLength * 2,
		// eslint-disable-next-line no-undef
		usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
	})

	const bindGroup: GPUBindGroup = device.createBindGroup({
		label: 'bindGroup for work buffer',
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 1,
				resource: {buffer: workBuffer}
			}
		]
	})

	const encoder = device.createCommandEncoder({label: 'doubling encoder'})

	const pass = encoder.beginComputePass({label: 'doubling compute pass'})

	pass.setPipeline(pipeline)
	pass.setBindGroup(0, bindGroup)
	pass.dispatchWorkgroups(1, input.length, 1)
	pass.end()

	encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, workBuffer.size)

	const commandBuffer = encoder.finish()
	device.queue.submit([commandBuffer])

	await resultBuffer.mapAsync(GPUMapMode.READ)
	const result = new Float32Array(resultBuffer.getMappedRange().slice(0))
	resultBuffer.unmap()
	console.log('input: ', input)
	console.log('result: ', result)
}
