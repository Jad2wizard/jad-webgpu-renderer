/* eslint-disable no-undef */
//code from webgpu-fundamentals
function rand(min?: any, max?: any) {
	if (min === undefined) {
		min = 0
		max = 1
	} else if (max === undefined) {
		max = min
		min = 0
	}
	return min + Math.random() * (max - min)
}

export async function main(canvas: HTMLCanvasElement) {
	const adapter = await navigator.gpu?.requestAdapter()
	const device = await adapter?.requestDevice()
	if (!device) {
		throw 'need a browser that supports WebGPU'
	}

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat()
	const ctx = canvas.getContext('webgpu')
	if (!ctx) return
	ctx.configure({
		device,
		format: presentationFormat
	})

	const vsModule = device.createShaderModule({
		label: 'triangle vertex shader with uniforms',
		code: `
			struct TransformStruct {
				scale: vec2f,
				offset: vec2f
			}

			struct Output {
				@builtin(position) position: vec4f,
				@location(0) color: vec4f
			}

			@group(0) @binding(0) var<storage, read> transforms: array<TransformStruct>;
			@group(0) @binding(1) var<storage, read> colors: array<vec4f>;

			@vertex fn vs(
				@builtin(vertex_index) vi: u32,
				@builtin(instance_index) ii: u32
			) -> Output {
				let pos = array(
					vec2f(0.0, 0.3),
					vec2f(-0.3, -0.3),
					vec2f(0.3, -0.3)
				);

				let transform = transforms[ii];
				var output: Output;
				output.position = vec4f(pos[vi] * transform.scale + transform.offset, 0, 1);
				output.color = colors[ii];

				return output;
			}
		`
	})

	const fsModule = device.createShaderModule({
		label: 'triangle fragment shader with uniforms',
		code: `
			@fragment fn fs(@location(0) color: vec4f) -> @location(0) vec4f {
				return color;
			}
		`
	})

	const pipeline = device.createRenderPipeline({
		label: 'triangle with uniforms',
		layout: 'auto',
		vertex: {
			module: vsModule,
			entryPoint: 'vs'
		},
		fragment: {
			module: fsModule,
			entryPoint: 'fs',
			targets: [{format: presentationFormat}]
		}
	})

	const kNumObjects = 100
	const transformStorageBuffer = device.createBuffer({
		label: 'transform storage buffer',
		size: kNumObjects * (2 + 2) * 4,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
	})
	const colorStorageBuffer = device.createBuffer({
		label: 'color storage buffer',
		size: kNumObjects * 4 * 4,
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
	})

	const transformStorageValue = new Float32Array(transformStorageBuffer.size / 4)
	const colorStorageValue = new Float32Array(colorStorageBuffer.size / 4)
	for (let i = 0; i < kNumObjects; ++i) {
		colorStorageValue.set([rand(), rand(), rand(), 1], i * 4)
		const scale = rand(0.3)
		transformStorageValue.set([scale, scale, rand(-0.9, 0.9), rand(-0.9, 0.9)], i * 4)
	}
	device.queue.writeBuffer(transformStorageBuffer, 0, transformStorageValue)
	device.queue.writeBuffer(colorStorageBuffer, 0, colorStorageValue)

	//对应vs 里的@group(0) @binding(0)
	const bindGroup = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{binding: 0, resource: {buffer: transformStorageBuffer}},
			{binding: 1, resource: {buffer: colorStorageBuffer}}
		]
	})

	const renderPassDescriptor: GPURenderPassDescriptor = {
		label: 'our basic canvas renderPass',
		colorAttachments: [
			{
				view: ctx.getCurrentTexture().createView(),
				clearValue: [0.3, 0.3, 0.3, 1],
				loadOp: 'clear',
				storeOp: 'store'
			}
		]
	}

	function render() {
		if (!device || !ctx) return

		//@ts-ignore
		renderPassDescriptor.colorAttachments[0].view = ctx.getCurrentTexture().createView()
		const encoder = device.createCommandEncoder({label: 'our encoder'})

		const pass = encoder.beginRenderPass(renderPassDescriptor)
		pass.setPipeline(pipeline)
		pass.setBindGroup(0, bindGroup)
		pass.draw(3, kNumObjects)
		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	const observer = new ResizeObserver(entries => {
		for (const entry of entries) {
			canvas.width = canvas.offsetWidth
			canvas.height = canvas.offsetHeight
			render()
		}
	})
	observer.observe(canvas)
}
