import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils'

const { UNIFORM, INDEX, VERTEX, STORAGE, MAP_READ, COPY_DST, COPY_SRC } = GPUBufferUsage

async function checkWebGPU() {
	const adapter = await navigator.gpu?.requestAdapter()
	const device = await adapter?.requestDevice()
	if (!device) {
		throw 'need a browser that supports webgpu'
	}
	//@ts-ignore
	window.d = device
	return device
}

const rand = (min?: number, max?: number) => {
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
	endAngle = Math.PI * 2,
} = {}) {
	//除了startAngle和endAngle之外，各个区间共用一条边，边的总数为区间数加一，一条边两个顶点
	const numVertices = (numSubdivisions + 1) * 2
	//将 perVertexColor 有 float32x3 改为 unorm8x4。单个顶点的 color 由12字节变为4字节
	//一个unorm8x4占用4字节空间，等于一个 float32
	const vertexData = new Float32Array(numVertices * (2 + 1))
	const vertexColorData = new Uint8Array(vertexData.buffer)

	const innerColor: [number, number, number] = [1, 1, 1]
	const outerColor: [number, number, number] = [0.1, 0.1, 0.1]

	let offset = 0
	const addVertex = (x: number, y: number, r: number, g: number, b: number) => {
		vertexData[offset++] = x
		vertexData[offset++] = y
		//unorm8在 js 端取值范围为0到255，webgpu 就将 unorm 转换到0到1之间传给着色器
		vertexColorData[offset * 4 + 0] = r * 255
		vertexColorData[offset * 4 + 1] = g * 255
		vertexColorData[offset * 4 + 2] = b * 255
		vertexColorData[offset * 4 + 3] = 255
		offset++
	}

	/**
	 * 0 2 4 6 8 ...
	 *
	 * 1 3 5 7 9 ...
	 */
	for (let i = 0; i <= numSubdivisions; ++i) {
		const angle1 = startAngle + ((i + 0) * (endAngle - startAngle)) / numSubdivisions

		const c1 = Math.cos(angle1)
		const s1 = Math.sin(angle1)

		addVertex(c1 * radius, s1 * radius, ...outerColor)
		addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor)
	}

	//一个区间两个三角形一共六个顶点索引
	const indexData = new Uint32Array(numSubdivisions * 6)
	for (let i = 0; i < numSubdivisions; ++i) {
		indexData[i * 6 + 0] = i * 2 + 0
		indexData[i * 6 + 1] = i * 2 + 1
		indexData[i * 6 + 2] = i * 2 + 2

		indexData[i * 6 + 3] = i * 2 + 1
		indexData[i * 6 + 4] = i * 2 + 3
		indexData[i * 6 + 5] = i * 2 + 2
	}

	return {
		vertexData,
		indexData,
		numVertices: indexData.length,
	}
}

async function renderPass() {
	const device = await checkWebGPU()

	const canvas = document.querySelector('#canvas') as HTMLCanvasElement
	canvas.width = canvas.offsetWidth
	canvas.height = canvas.offsetHeight
	const presentationFormat = navigator.gpu?.getPreferredCanvasFormat()
	const context = canvas.getContext('webgpu')
	if (!context) {
		console.error('need a browser that supports webgpu')
		return
	}
	context.configure({
		device,
		format: presentationFormat,
	})

	const shaderCode = `
			struct Vertex {
				@location(0) position: vec2f,
				@location(1) color: vec4f,
				@location(2) offset: vec2f,
				@location(3) scale: vec2f,
				@location(4) perVertexColor: vec4f,
			};

			struct VSOut {
				@builtin(position) position: vec4f,
				@location(0) color: vec4f
			};

            @vertex fn vs( vert: Vertex) -> VSOut {
				var output: VSOut;
                
                output.position = vec4f(vert.position * vert.scale + vert.offset, 0, 1);
				output.color = vert.color * vert.perVertexColor;
				return output;
            }
            
            @fragment fn fs(@location(0) color: vec4f) -> @location(1) vec4f {
                return color;
            }
    `

	const shaderModule = device.createShaderModule({
		label: 'triangle shaders with uniforms',
		code: shaderCode,
	})

	const pipeline = device.createRenderPipeline({
		label: 'storage buffer like uniform',
		layout: 'auto',
		vertex: {
			entryPoint: 'vs',
			module: shaderModule,
			buffers: [
				{
					arrayStride: (2 + 1) * 4, // 2 floats, 4 bytes each
					stepMode: 'vertex',
					attributes: [
						{ shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
						{ shaderLocation: 4, offset: 2 * 4, format: 'unorm8x4' }, // perVertexColor
						//perVertexColor 在 wgsl 中的类型为 vec4f，但在 js 中设置的却是 float32x3
						//这样并不会影响渲染结果，因为 wgsl 中的 vec4f 的默认值为 (0, 0, 0, 1)。webgpu 在
						//解析perVertexColor 顶点数据时会自动补齐最后一个分量为1.所以 webgpu 中的顶点数据
						//的类型在 wgsl 中和 js 中的定义不一定要一致
					],
				},
				{
					arrayStride: (1 + 2) * 4, // 2 floats, 4 bytes each
					stepMode: 'instance',
					attributes: [
						{ shaderLocation: 1, offset: 0, format: 'unorm8x4' }, // color
						{ shaderLocation: 2, offset: 1 * 4, format: 'float32x2' }, // offset
					],
				},
				{
					arrayStride: 2 * 4, // 2 floats, 4 bytes each
					stepMode: 'instance',
					attributes: [
						{ shaderLocation: 3, offset: 0, format: 'float32x2' }, // scale
					],
				},
			],
		},
		fragment: {
			entryPoint: 'fs',
			module: shaderModule,
			targets: [null, { format: presentationFormat }],
		},
	})

	const kNumObjects = 100
	const objectInfos: any[] = []
	//@ts-ignore
	const staticUnitSize = (1 + 2) * 4
	//@ts-ignore
	const dynamicUnitSize = 2 * 4

	const staticVertexBuffer = device.createBuffer({
		label: `static storage for objects`,
		size: staticUnitSize * kNumObjects,
		usage: VERTEX | COPY_DST,
	})
	const dynamicVertexBuffer = device.createBuffer({
		label: 'dynamic storage for objects',
		size: dynamicUnitSize * kNumObjects,
		usage: VERTEX | COPY_DST,
	})

	const staticVertexValues = new Float32Array(staticVertexBuffer.size / 4)
	const colorValues = new Uint8Array(staticVertexValues.buffer)
	for (let i = 0; i < kNumObjects; ++i) {
		const offset = i * (staticUnitSize / 4)
		colorValues[offset * 4 + 0] = rand() * 255
		colorValues[offset * 4 + 1] = rand() * 255
		colorValues[offset * 4 + 2] = rand() * 255
		colorValues[offset * 4 + 3] = 255
		staticVertexValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], offset + 1)
		objectInfos.push({
			scale: rand(0.1, 0.4),
		})
	}
	device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValues)

	const storageValues = new Float32Array(dynamicVertexBuffer.size / 4)

	const { vertexData, numVertices, indexData } = createCircleVertices({
		numSubdivisions: 32,
		radius: 0.5,
		innerRadius: 0.25,
	})
	const vertexBuffer = device.createBuffer({
		label: 'vertex buffer vertices',
		size: vertexData.byteLength,
		usage: VERTEX | COPY_DST,
	})
	device.queue.writeBuffer(vertexBuffer, 0, vertexData)

	const indexBuffer = device.createBuffer({
		label: 'index buffer',
		size: indexData.byteLength,
		usage: INDEX | COPY_DST,
	})
	device.queue.writeBuffer(indexBuffer, 0, indexData)

	const renderPassDescriptor: GPURenderPassDescriptor = {
		label: 'our basic canvas renderPass',
		colorAttachments: [
			null,
			{
				view: context.getCurrentTexture().createView(),
				clearValue: [0.3, 0.3, 0.3, 1],
				loadOp: 'clear',
				storeOp: 'store',
			},
		],
	}

	const canvasToSizeMap = new WeakMap<HTMLCanvasElement, { width: number; height: number }>()

	function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
		let { width, height } = canvasToSizeMap.get(canvas) || { width: canvas.width, height: canvas.height }

		width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D))
		height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D))

		const needResize = canvas.width !== width || canvas.height !== height
		if (needResize) {
			canvas.width = width
			canvas.height = height
		}
		return needResize
	}

	function render() {
		if (!context || !device) return
		resizeCanvasToDisplaySize(canvas)
		;(renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[1].view = context
			.getCurrentTexture()
			.createView()

		const encoder = device.createCommandEncoder({ label: 'our encoder' })
		const pass = encoder.beginRenderPass(renderPassDescriptor)
		pass.setPipeline(pipeline) //renderPass调用的方法不会直接执行，而是录制在 command buffer中，直接提交到 GPU 后才会执行
		pass.setVertexBuffer(0, vertexBuffer)
		pass.setVertexBuffer(1, staticVertexBuffer)
		pass.setVertexBuffer(2, dynamicVertexBuffer)
		pass.setIndexBuffer(indexBuffer, 'uint32')

		const aspect = canvas.width / canvas.height

		for (let i = 0; i < kNumObjects; ++i) {
			const offset = (i * dynamicUnitSize) / 4
			const { scale } = objectInfos[i]
			storageValues.set([scale / aspect, scale], offset)
		}
		device.queue.writeBuffer(dynamicVertexBuffer, 0, storageValues)

		pass.drawIndexed(numVertices, kNumObjects)

		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	const observer = new ResizeObserver((entries) => {
		for (const entry of entries) {
			canvasToSizeMap.set(entry.target as HTMLCanvasElement, {
				width: entry.contentBoxSize[0].inlineSize,
				height: entry.contentBoxSize[0].blockSize,
			})
			render()
		}
	})

	observer.observe(canvas)

	render()
}

renderPass()

async function computePass() {
	const device = await checkWebGPU()

	const shaderModule = device.createShaderModule({
		label: 'doubling compute module',
		code: `
            @group(0) @binding(0) var<storage, read_write> data: array<f32>;

            @compute @workgroup_size(1) fn computeSomething(
                @builtin(global_invocation_id) id: vec3u
            ){
                let i = id.x;
                data[i] = data[i] * 2.0;
            }
        `,
	})

	const pipeline = device.createComputePipeline({
		label: 'doubling compute pipeline',
		layout: 'auto',
		compute: { module: shaderModule },
	})

	const input = new Float32Array([1, 3, 5])

	//在显存中开辟一块 buffer 存放位于内存中 input 的数据
	const workBuffer = device.createBuffer({
		label: 'work buffer',
		size: input.byteLength,
		usage: STORAGE | COPY_DST | COPY_SRC, //COPY_DST意味这 buffer 会用作 copy 操作的目标 buffer，即将数据拷贝到该 buffer 中
	})

	//device.queue.writeBuffer会立即将写入数据到 GPU buffer的命令提交给 GPU
	//该操作应该放在renderPass.draw或者computePass.dispatchWorkgroups等操作前面
	device.queue.writeBuffer(workBuffer, 0, input)

	//js中无法直接读取GPUBuffer，通过设置usage: MAP_READ可以将GPUBuffer 映射到
	//CPU 可以访问的内存中。这个过程涉及数据的拷贝，但GPU 会保证在映射前对该 GPUBuffer 的
	//所有操作后再进行映射，从而确保了内存和显存中两份数据的一致性。当然数据在内存中也是只读的
	const resultBuffer = device.createBuffer({
		label: 'result buffer',
		size: workBuffer.size,
		usage: COPY_DST | MAP_READ,
	})

	//bindGroup用以告诉 GPU 如何获取需要访问的 buffer 或者纹理等资源
	//一个 bindGroup 对应 shader 中的一个@group(index),
	//其中 index 对应pipeline.getBindGroupLayout(index)
	//@binding(0)对应 entries[0].binding
	const bindGroup = device.createBindGroup({
		label: 'bindGroup for work buffer',
		layout: pipeline.getBindGroupLayout(0),
		entries: [{ binding: 0, resource: { buffer: workBuffer } }],
	})

	const encoder = device.createCommandEncoder({
		label: 'doubling encoder',
	})
	const computePass = encoder.beginComputePass({
		label: 'doubling compute pass',
	})

	computePass.setPipeline(pipeline)
	computePass.setBindGroup(0, bindGroup) //设置@group(0)的 bingGroup
	//告诉 GPU 执行 workgroup 的次数，每个 workgroup 执行workgroup.x*y*z次 compute shader
	computePass.dispatchWorkgroups(input.length)
	computePass.end()

	//compute shader计算完后将计算结果从 workBuffer 拷贝到 resultBuffer 中。
	//因为GPUBufferUsage.STORAGE 和 MAP_READ无法共存，所以无法直接将 workBuffer 映射到内存中
	//与 device.queue.writeBuffer不同，copyBufferToBuffer 不会立即提交到 GPU
	encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size)

	const commandBuffer = encoder.finish()
	device.queue.submit([commandBuffer])

	await resultBuffer.mapAsync(GPUMapMode.READ)
	const result = new Float32Array(resultBuffer.getMappedRange().slice(0))
	//resultBuffer关闭映射后，ArrayBuffer 就无法在访问了，所以通过 slice 拷贝了一份出来
	resultBuffer.unmap()

	console.log('input', input)
	console.log('result', result)
}

computePass()
