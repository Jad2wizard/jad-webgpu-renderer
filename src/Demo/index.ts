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
            @vertex fn vs(
                @builtin(vertex_index) vertexIndex: u32
            ) -> @builtin(position) vec4f {
                let pos = array(
                    vec2f(0.0, 0.5),
                    vec2f(-0.75, -0.5),
                    vec2f(0.0, -0.5),
                    vec2f(0.01, 0.5),
                    vec2f(0.01, -0.5),
                    vec2f(0.75, -0.5),
                );

                return vec4f(pos[vertexIndex], 0.0, 1.0);
            }

            @fragment fn fs() -> @location(0) vec4f {
                return vec4f(1, 0, 0, 1);
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
                    vec2f(0.0, 0.5),
                    vec2f(-0.75, -0.5),
                    vec2f(0.0, -0.5),
                    vec2f(0.01, 0.5),
                    vec2f(0.01, -0.5),
                    vec2f(0.75, -0.5),
                );

                return vec4f(pos[vertexIndex + 3], 0.0, 1.0);
            }

            @fragment fn fs() -> @location(0) vec4f {
                return vec4f(1, 1, 0, 1);
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
