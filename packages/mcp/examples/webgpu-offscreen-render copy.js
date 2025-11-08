/**
 * WebGPU 离线渲染示例
 * 使用官方 webgpu npm 包在 Node.js 中进行 GPU 渲染
 */

import { create, globals } from 'webgpu'
import { PNG } from 'pngjs'
import fs from 'fs'

// 设置全局 WebGPU 对象
Object.assign(globalThis, globals)

async function offscreenRender() {
	let navigator = null
	let adapter = null

	console.log('正在尝试初始化 WebGPU...')

	try {
		console.log('尝试后端: metal')
		navigator = {
			gpu: create(['enable-dawn-features=allow_unsafe_apis']),
		}

		adapter = await navigator.gpu.requestAdapter({
			powerPreference: 'high-performance',
		})
	} catch (error) {
		console.log(`webgpu后端失败:`, error.message)
		return
	}

	if (!adapter) {
		throw new Error('无法获取 WebGPU 适配器')
	}

	try {
		const device = await adapter.requestDevice()

		// 创建渲染纹理
		const width = 512
		const height = 512

		const texture = device.createTexture({
			size: { width, height },
			format: 'rgba8unorm',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
		})

		// 创建简单的顶点着色器
		const vertexShaderCode = `
      @vertex
      fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
        var pos = array<vec2f, 3>(
          vec2f(-0.5, -0.5),
          vec2f( 0.5, -0.5),
          vec2f( 0.0,  0.5)
        );
        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }
    `

		// 创建简单的片段着色器
		const fragmentShaderCode = `
      @fragment
      fn main() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0); // 红色三角形
      }
    `

		// 创建着色器模块
		const vertexShader = device.createShaderModule({ code: vertexShaderCode })
		const fragmentShader = device.createShaderModule({ code: fragmentShaderCode })

		// 创建渲染管线
		const pipeline = device.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: vertexShader,
				entryPoint: 'main',
			},
			fragment: {
				module: fragmentShader,
				entryPoint: 'main',
				targets: [
					{
						format: 'rgba8unorm',
					},
				],
			},
			primitive: {
				topology: 'triangle-list',
			},
		})

		// 创建命令编码器
		const commandEncoder = device.createCommandEncoder()

		// 开始渲染通道
		const renderPass = commandEncoder.beginRenderPass({
			colorAttachments: [
				{
					view: texture.createView(),
					clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
		})

		// 执行渲染
		renderPass.setPipeline(pipeline)
		renderPass.draw(3) // 绘制三角形
		renderPass.end()

		// 创建缓冲区用于读取像素数据
		const readBuffer = device.createBuffer({
			size: width * height * 4, // RGBA
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		})

		// 复制纹理到缓冲区
		commandEncoder.copyTextureToBuffer(
			{ texture },
			{ buffer: readBuffer, bytesPerRow: width * 4 },
			{ width, height }
		)

		// 提交命令
		device.queue.submit([commandEncoder.finish()])

		// 读取渲染结果
		await readBuffer.mapAsync(GPUMapMode.READ)
		const arrayBuffer = readBuffer.getMappedRange()
		const pixels = new Uint8Array(arrayBuffer)

		// 使用 pngjs 保存为 PNG 格式
		// WebGPU 输出的是 RGBA 格式，需要垂直翻转（WebGPU 坐标系与图像坐标系不同）
		const rgbaBuffer = Buffer.from(pixels)

		// 创建 PNG 对象
		const png = new PNG({
			width: width,
			height: height,
			filterType: -1,
		})

		png.data = rgbaBuffer
		// 复制像素数据并进行垂直翻转
		// for (let y = 0; y < height; y++) {
		// 	for (let x = 0; x < width; x++) {
		// 		// 源位置（WebGPU 输出）
		// 		const srcY = y // 垂直翻转
		// 		const srcIdx = (srcY * width + x) * 4

		// 		// 目标位置（PNG 格式）
		// 		const dstIdx = (y * width + x) * 4

		// 		// 复制 RGBA 数据
		// 		png.data[dstIdx] = rgbaBuffer[srcIdx] // R
		// 		png.data[dstIdx + 1] = rgbaBuffer[srcIdx + 1] // G
		// 		png.data[dstIdx + 2] = rgbaBuffer[srcIdx + 2] // B
		// 		png.data[dstIdx + 3] = rgbaBuffer[srcIdx + 3] // A
		// 	}
		// }

		// 保存 PNG 文件
		const buffer = PNG.sync.write(png)
		fs.writeFileSync('./output.png', buffer)

		console.log('渲染完成，图像已保存为 output.png')

		// 清理资源
		readBuffer.unmap()
		texture.destroy()
		device.destroy()
	} catch (error) {
		console.error('渲染失败:', error)
	}
}

// 运行示例
offscreenRender().catch(console.error)
