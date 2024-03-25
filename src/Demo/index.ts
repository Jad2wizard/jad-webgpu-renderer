//code from webgpu-fundamentals
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

	const module1 = device.createShaderModule({
		label: 'our hardcoded red triangle shaders',
		code: `
			struct VertexOutput {
				@builtin(position) position: vec4f,
				@location(0) color: vec4f
			}

            @vertex fn vs(
                @builtin(vertex_index) vertexIndex: u32
            ) -> VertexOutput {
                let pos = array(
                    vec2f(0.0, 0.5),
                    vec2f(-0.75, -0.5),
                    vec2f(0.0, -0.5),
				);
				
				let color = array(
					vec4f(1, 0, 0, 1),
					vec4f(0, 1, 0, 1),
					vec4f(0, 0, 1, 1),
				);

				var output: VertexOutput;
				output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
				output.color = color[vertexIndex];
				return output;
            }

			//inter-stage variables 与 webgl 的 varying 变量一样，是 vertexShader 输出经过插值后传给 fragmentShader
			//inter-stage variables不要求 vs的输出格式和 fs 的输入格式一致，只根据@location(?)来标识不同变量。
			//本例中 vs 输出的是一个包含有 color 和 position 的结构体
			//但 fs 确接收了两个参数，一个 color 和内置的 position，该 position 并不是 vs输出的 position，而是 fs 内置的输入变量，表示 fs 所处理像素在纹理中的坐标
            @fragment fn fs(@location(0) color: vec4f, @builtin(position) position: vec4f) -> @location(0) vec4f {
				let red = vec4f(1, 0, 0, 1);
				let grid = vec2u(position.xy) / 16;
				let checker = (grid.x + grid.y) % 2 == 1;
				return select(red, color, checker);
				return color;
            }
        `
	})

	const module2 = device.createShaderModule({
		label: 'our hardcoded red triangle shaders',
		code: `
            @vertex fn vs(
                @builtin(vertex_index) vertexIndex: u32
            ) -> @builtin(position) vec4f {
                let pos = array(
                    vec2f(0.01, 0.5),
                    vec2f(0.01, -0.5),
                    vec2f(0.75, -0.5),
                );

                return vec4f(pos[vertexIndex], 0.0, 1.0);
            }

			//fragmentShader 输入的内置 position 为当前像素的坐标
            @fragment fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
				let red = vec4f(1, 0, 0, 1);
				let cyan = vec4f(0, 1, 1, 1);
				let grid = vec2u(position.xy) / 16;
				let checker = (grid.x + grid.y) % 2 == 1;
				return select(red, cyan, checker);
            }
        `
	})

	const pipeline1 = device.createRenderPipeline({
		label: 'our hardcoded red triangle pipelien',
		layout: 'auto', //让webgpu根据shader里的资源定义自动创建pipelineLayout
		vertex: {
			module: module1,
			entryPoint: 'vs'
		},
		fragment: {
			module: module1,
			entryPoint: 'fs',
			targets: [{format: presentationFormat}]
		}
	})

	const pipeline2 = device.createRenderPipeline({
		label: 'our hardcoded red triangle pipelien',
		layout: 'auto', //让webgpu根据shader里的资源定义自动创建pipelineLayout
		vertex: {
			module: module2,
			entryPoint: 'vs'
		},
		fragment: {
			module: module2,
			entryPoint: 'fs',
			targets: [{format: presentationFormat}]
		}
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
		pass.setPipeline(pipeline1)
		pass.draw(3)
		pass.setPipeline(pipeline2)
		pass.draw(3)
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
