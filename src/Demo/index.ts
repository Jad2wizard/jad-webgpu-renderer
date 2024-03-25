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

function createCircleVertices({
	radius = 1,
	numSubdivisions = 24,
	innerRadius = 0,
	startAngle = 0,
	endAngle = Math.PI * 2
}: {
	radius?: number
	numSubdivisions?: number
	innerRadius?: number
	startAngle?: number
	endAngle?: number
}) {
	const numVertices = numSubdivisions * 3 * 2
	//vertexData 中包含两个 float32的 position 和四个 uint8的 color。四个 uint8的 color 长度等于一个 float32
	const vertexData = new Float32Array(numSubdivisions * 3 * 2 * (2 + 1))
	//创建 vertexData 的 Uint8Array 视图，用于写入uint8类型的 color
	const colorData = new Uint8Array(vertexData.buffer)
	let offset = 0
	let colorOffset = 8 //color 前面有两个 float32组成的 position，两个 float32长度等于8个 uint8
	const addVertex = (x: number, y: number, r: number, g: number, b: number) => {
		vertexData[offset++] = x
		vertexData[offset++] = y
		offset++ //跳过 position 后面的四个 uint8 组成的 color
		colorData[colorOffset++] = r * 255
		colorData[colorOffset++] = g * 255
		colorData[colorOffset++] = b * 255
		colorOffset += 9 //跳过 color 最后一个alpha 分量以及 color 后面的 position
	}
	const innerColor = [0.9, 0.1, 0]
	const outerColor = [0.5, 0.6, 0.1]

	// 2 vertices per subdivision
	//
	// 0--1 4
	// | / /|
	// |/ / |
	// 2 3--5
	for (let i = 0; i < numSubdivisions; ++i) {
		const angle1 = startAngle + ((i + 0) * (endAngle - startAngle)) / numSubdivisions
		const angle2 = startAngle + ((i + 1) * (endAngle - startAngle)) / numSubdivisions

		const c1 = Math.cos(angle1)
		const s1 = Math.sin(angle1)
		const c2 = Math.cos(angle2)
		const s2 = Math.sin(angle2)

		// first triangle
		//@ts-ignore
		addVertex(c1 * radius, s1 * radius, ...outerColor)
		//@ts-ignore
		addVertex(c2 * radius, s2 * radius, ...outerColor)
		//@ts-ignore
		addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor)

		// second triangle
		//@ts-ignore
		addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor)
		//@ts-ignore
		addVertex(c2 * radius, s2 * radius, ...outerColor)
		//@ts-ignore
		addVertex(c2 * innerRadius, s2 * innerRadius, ...innerColor)
	}

	return {vertexData, numVertices}
}

export async function main(canvas: HTMLCanvasElement) {
	const adapter = await navigator.gpu?.requestAdapter()
	const device = await adapter?.requestDevice()
	if (!device) {
		throw 'need a browser that supports WebGPU'
	}
	//@ts-ignore
	window.device = device

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
			struct Output {
				@builtin(position) position: vec4f,
				@location(0) color: vec4f
			}

			struct Input{
				@location(0) position: vec2f,
				@location(1) scale: vec2f,
				@location(2) offset: vec2f,
				@location(3) color: vec4f
			}

			@vertex fn vs(
				vert: Input,
			) -> Output {
				var output: Output;
				output.position = vec4f(vert.position * vert.scale + vert.offset, 0, 1);
				output.color = vert.color;

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
			entryPoint: 'vs',
			buffers: [
				{
					arrayStride: 2 * 4 + 4,
					attributes: [
						{shaderLocation: 0, offset: 0, format: 'float32x2'},
						{shaderLocation: 3, offset: 4 * 2, format: 'unorm8x4'}
					]
				},
				{
					//transform
					arrayStride: (2 + 2) * 4,
					stepMode: 'instance',
					attributes: [
						{shaderLocation: 1, offset: 0, format: 'float32x2'},
						{shaderLocation: 2, offset: 2 * 4, format: 'float32x2'}
					]
				}
			]
		},
		fragment: {
			module: fsModule,
			entryPoint: 'fs',
			targets: [{format: presentationFormat}]
		}
	})

	const kNumObjects = 100
	const transformVertexBuffer = device.createBuffer({
		label: 'transform vertex buffer',
		size: kNumObjects * (2 + 2) * 4,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	})

	const transformVertexValue = new Float32Array(transformVertexBuffer.size / 4)
	const aspect = canvas.width / canvas.height
	for (let i = 0; i < kNumObjects; ++i) {
		const scale = rand(0.3)
		transformVertexValue.set([scale / aspect, scale, rand(-0.9, 0.9), rand(-0.9, 0.9)], i * 4)
	}
	device.queue.writeBuffer(transformVertexBuffer, 0, transformVertexValue)

	const {vertexData, numVertices} = createCircleVertices({radius: 0.5, innerRadius: 0.25, numSubdivisions: 32})
	const vertexBuffer = device.createBuffer({
		label: 'vertex buffer vertices',
		size: vertexData.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	})
	device.queue.writeBuffer(vertexBuffer, 0, vertexData)

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
		pass.setVertexBuffer(0, vertexBuffer)
		pass.setVertexBuffer(1, transformVertexBuffer)
		pass.draw(numVertices, kNumObjects)
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
