async function main() {
	const adapter = await navigator.gpu?.requestAdapter()
	const device = await adapter?.requestDevice()
	if (!device) {
		console.error('need a browser that supports webgpu')
		return
	}

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

	const shaderModule = device.createShaderModule({
		label: 'our hardcoded red triangle shaders',
		code: `
            @vertex fn vs(
                @builtin(vertex_index) vi: u32
            ) -> @builtin(position) vec4f {
                let pos = array(
                    vec2f(0.0, 0.5),
                    vec2f(-0.5, -0.5),
                    vec2f(0.5, -0.5)
                );
                return vec4f(pos[vi], 0.0, 1.0);
            }
            
            @fragment fn fs() -> @location(1) vec4f {
                return vec4f(1.0, 0.0, 0.0, 1.0);
            }
        `,
	})

	const pipeline = device.createRenderPipeline({
		label: 'our hardcoded red triangle pipeline',
		layout: 'auto',
		vertex: {
			entryPoint: 'vs',
			module: shaderModule,
		},
		fragment: {
			entryPoint: 'fs',
			module: shaderModule,
			targets: [null, { format: presentationFormat }],
		},
	})

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

	function render() {
		if (!context || !device) return
		;(renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[1].view = context
			.getCurrentTexture()
			.createView()

		const encoder = device.createCommandEncoder({ label: 'our encoder' })

		const pass = encoder.beginRenderPass(renderPassDescriptor)
		pass.setPipeline(pipeline)
		pass.draw(3)
		pass.end()

		const commandBuffer = encoder.finish()
		device.queue.submit([commandBuffer])
	}

	render()
}

main()
