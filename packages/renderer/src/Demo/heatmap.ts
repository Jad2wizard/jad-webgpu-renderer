import { makeShaderDataDefinitions } from 'webgpu-utils'

async function main() {
	const canvas = document.querySelector('#canvas') as HTMLCanvasElement
	canvas.width = canvas.offsetWidth / 1
	canvas.height = canvas.offsetHeight / 1

	console.log(canvas.width, canvas.height)

	const context = canvas.getContext('webgpu') || null
	if (!context) return
	const adapter = await navigator.gpu.requestAdapter()
	const device = await adapter?.requestDevice({
		requiredLimits: {
			maxBufferSize: 800 * 1024 * 1024,
		},
	})
	if (!device) return

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
	context.configure({
		device,
		format: presentationFormat,
		alphaMode: 'premultiplied',
	})

	const num = 200
	const radius = 20
	const points = new Float32Array(num * 2)
	const size = new Uint8Array(num * 4)

	for (let i = 0; i < num; ++i) {
		points[i * 2] = Math.random() * 2 - 1
		points[i * 2 + 1] = Math.random() * 2 - 1
		size[i * 4] = ((Math.random() * 15) | 0) + 15
		size[i * 4 + 1] = (Math.random() / 2 + 0.3) * 255
	}
	console.log(size)

	const s = new Date().valueOf()

	const heatShaderModule = device.createShaderModule({
		label: 'heat shader module',
		code: `
			struct Vertex {
				@builtin(vertex_index) vi: u32,
				@location(0) position: vec2f,
				@location(1) sizes: vec2u
			};

			struct VSOutput {
				@builtin(position) position: vec4f,
				@location(0) pointCoord: vec2f,
				@location(1) opacity: f32,
			};

			@group(0) @binding(0) var<uniform> resolution: vec2f;
			@group(0) @binding(1) var<uniform> size: f32;

			@vertex fn vs(vert: Vertex) ->  VSOutput{
				_ = size;
				let points = array(
					vec2f(-1, -1),
					vec2f( 1, -1),
					vec2f(-1,  1),
					vec2f(-1,  1),
					vec2f( 1, -1),
					vec2f( 1,  1),
				);

        		let pos = points[vert.vi];
				let pointPos = pos * f32(vert.sizes.x) / resolution;

        		var vsOut: VSOutput;
				vsOut.position = vec4f(vert.position + pointPos, 0, 1);
				vsOut.pointCoord = pos;
				vsOut.opacity = f32(vert.sizes.y) / 255f;

				return vsOut;
			}

			@fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
				return vec4f(1, 0, 0, vsOut.opacity);
			}
		`,
	})

	const heatPipeline = device.createRenderPipeline({
		label: 'heat pipeline',
		layout: 'auto',
		vertex: {
			module: heatShaderModule,
			entryPoint: 'vs',
			buffers: [
				{
					arrayStride: 4 * 2,
					stepMode: 'instance',
					attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
				},
				{
					arrayStride: 1 * 4,
					stepMode: 'instance',
					attributes: [{ shaderLocation: 1, offset: 0, format: 'uint8x4' }],
				},
			],
		},
		fragment: {
			module: heatShaderModule,
			entryPoint: 'fs',
			targets: [
				{
					format: presentationFormat,
					blend: {
						color: {
							srcFactor: 'one',
							dstFactor: 'one',
						},
						alpha: {
							srcFactor: 'one',
							dstFactor: 'one',
						},
					},
				},
			],
		},
	})

	const vertexBuffer = device.createBuffer({
		label: 'points buffer',
		size: points.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	})
	device.queue.writeBuffer(vertexBuffer, 0, points)

	const sizesBuffer = device.createBuffer({
		label: 'size and opacity buffer',
		size: size.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	})
	device.queue.writeBuffer(sizesBuffer, 0, size)

	const resolutionValue = new Float32Array([canvas.width, canvas.height])
	const resolutionBuffer = device.createBuffer({
		label: 'Resolution Uniforms',
		size: resolutionValue.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})
	device.queue.writeBuffer(resolutionBuffer, 0, resolutionValue)

	const sizeVal = new Float32Array([radius])
	const sizeBuffer = device.createBuffer({
		size: sizeVal.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})
	device.queue.writeBuffer(sizeBuffer, 0, sizeVal)
	const bindGroup = device.createBindGroup({
		layout: heatPipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: { buffer: resolutionBuffer },
			},
			{
				binding: 1,
				resource: { buffer: sizeBuffer },
			},
		],
	})

	const heatRenderPassDesc: GPURenderPassDescriptor = {
		label: 'heat renderPass',
		colorAttachments: [
			{
				view: context.getCurrentTexture().createView(),
				clearValue: [0, 0, 0, 0],
				loadOp: 'clear',
				storeOp: 'store',
			},
		],
	}

	const encoder = device.createCommandEncoder()
	const renderPass = encoder.beginRenderPass(heatRenderPassDesc)
	renderPass.setPipeline(heatPipeline)
	renderPass.setVertexBuffer(0, vertexBuffer)
	renderPass.setVertexBuffer(1, sizesBuffer)
	renderPass.setBindGroup(0, bindGroup)
	renderPass.draw(6, num)
	renderPass.end()

	const commandBuffer = encoder.finish()
	device.queue.submit([commandBuffer])
	// await readBuffer.mapAsync(GPUMapMode.READ)
	// const data = new Float32Array(readBuffer.getMappedRange())
	// console.log(data)
	await device.queue.onSubmittedWorkDone()
	console.log(new Date().valueOf() - s)
}

main()
