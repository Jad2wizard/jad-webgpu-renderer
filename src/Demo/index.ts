/* eslint-disable no-undef */
//code from webgpu-fundamentals
import {Matrix3, Matrix4} from 'three'
import {makeShaderDataDefinitions, makeStructuredView} from 'webgpu-utils'

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

	const code = `
		struct A {
			a: f32,
			b: vec4f
		};
		struct UniformStruct {
			projectionMatrix: mat4x4<f32>,
			scale: vec2f,
			offset: vec2f,
		};

		@group(0) @binding(0) var<uniform> transform: UniformStruct;
		@group(1) @binding(0) var<uniform> color: vec4f;

		struct Input{
			@location(0) position: vec2f,
			@location(1) scale: vec2f,
			@location(2) offset: vec2f,
			@location(3) color: vec4f
		}

		@vertex fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
			let pos = array(
				vec2f(0.0, 0.3),
				vec2f(-0.3, -0.3),
				vec2f(0.3, -0.3)
			);

			let p = vec4f(pos[vi] * transform.scale + transform.offset, 0, 1);
			return transform.projectionMatrix * p;
		}

		@fragment fn fs() -> @location(0) vec4f {
			return color;
		}
	`
	const module = device.createShaderModule({
		label: 'triangle vertex shader with uniforms',
		code
	})

	const projectionMat = new Matrix4()
	projectionMat.set(1, 0, 0, 0.5, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)

	const defs = makeShaderDataDefinitions(code)
	console.log(defs)
	const transformValues = makeStructuredView(defs.uniforms.transform)
	transformValues.set({
		projectionMatrix: projectionMat.elements,
		offset: [0, 0],
		scale: [1, 1]
	})
	const colorValues = makeStructuredView(defs.uniforms.color)
	colorValues.set([0.1, 0.9, 0.89, 1])

	const pipeline = device.createRenderPipeline({
		label: 'triangle with uniforms',
		layout: 'auto',
		vertex: {
			module,
			entryPoint: 'vs'
		},
		fragment: {
			module,
			entryPoint: 'fs',
			targets: [{format: presentationFormat}]
		}
	})

	//const transformUniformValues = new Float32Array(2 + 2)
	//const colorUniformValue = new Float32Array(4)
	//transformUniformValues.set([0.5, 0.5, 0.3, 0.0])
	//colorUniformValue.set([0, 1, 0, 1])

	const transformUniformBuffer = device.createBuffer({
		size: transformValues.arrayBuffer.byteLength, // transformUniformValues.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	})

	const colorUniformBuffer = device.createBuffer({
		size: colorValues.arrayBuffer.byteLength,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
	})

	//对应vs 里的@group(0) @binding(0)
	const bindGroup = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [{binding: 0, resource: {buffer: transformUniformBuffer}}]
	})

	//对应 fs 里的@group(1) @binding(0)
	const bindGroup1 = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(1),
		entries: [{binding: 0, resource: {buffer: colorUniformBuffer}}]
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

	const m3 = new Matrix3()
	m3.set(1, 2, 3, 4, 5, 6, 7, 8, 9)
	console.log(m3)

	function render() {
		if (!device || !ctx) return

		device.queue.writeBuffer(transformUniformBuffer, 0, transformValues.arrayBuffer)
		device.queue.writeBuffer(colorUniformBuffer, 0, colorValues.arrayBuffer)

		//@ts-ignore
		renderPassDescriptor.colorAttachments[0].view = ctx.getCurrentTexture().createView()
		const encoder = device.createCommandEncoder({label: 'our encoder'})

		const pass = encoder.beginRenderPass(renderPassDescriptor)
		pass.setPipeline(pipeline)
		pass.setBindGroup(0, bindGroup)
		pass.setBindGroup(1, bindGroup1)
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
