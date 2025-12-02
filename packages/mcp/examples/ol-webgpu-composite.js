import puppeteer from 'puppeteer'
import { createRequire } from 'module'
import sharp from 'sharp'
import fs from 'fs'
import { create, globals } from 'webgpu'
import { createCanvas } from 'canvas'
const require = createRequire(import.meta.url)

/**
 * 最终版：OpenLayers + WebGPU 散点合成渲染器
 *
 * 功能特点：
 * 1. 使用 Puppeteer 无头模式渲染 OpenLayers 地图
 * 2. 使用 Node.js WebGPU 直接渲染散点（无需浏览器）
 * 3. 分别渲染 OpenLayers 地图和 WebGPU 散点
 * 4. 生成透明背景的散点图片用于合成
 * 5. 优化的性能，减少浏览器依赖
 *
 * 使用方法：
 * node ol-webgpu-composite.js
 *
 * 环境变量：
 * WIDTH, HEIGHT, DPR - 输出尺寸和分辨率
 * LON, LAT, ZOOM - 地图中心和缩放级别
 * SCATTER_COUNT, SCATTER_SIZE - 散点数量和大小
 * OUTPUT - 输出文件名
 */
async function renderComposite() {
	// 通用配置
	const width = parseInt(
		process.env.WIDTH || process.env.OL_WIDTH || process.env.WG_WIDTH || '1024',
		10
	)
	const height = parseInt(
		process.env.HEIGHT || process.env.OL_HEIGHT || process.env.WG_HEIGHT || '768',
		10
	)
	const dpr = parseFloat(process.env.DPR || process.env.OL_DPR || process.env.WG_DPR || '2')
	const output = process.env.OUTPUT || 'ol-webgpu-final.png'

	// 地图参数
	const centerLon = parseFloat(process.env.LON || process.env.OL_LON || '116.4074')
	const centerLat = parseFloat(process.env.LAT || process.env.OL_LAT || '39.9042')
	const zoom = parseFloat(process.env.ZOOM || process.env.OL_ZOOM || '13')
	const tileUrl = process.env.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

	// 散点参数
	const scatterCount = parseInt(process.env.SCATTER_COUNT || process.env.WG_COUNT || '800', 10)
	const pointSize = parseFloat(process.env.SCATTER_SIZE || process.env.WG_SIZE || '6')

	console.log('🎯 OpenLayers + WebGPU 合成渲染器 (双模式)')  
	console.log(`📐 尺寸: ${width}x${height} @${dpr}x`)
	console.log(`🗺️  地图中心: ${centerLon}, ${centerLat} (缩放: ${zoom})`)
	console.log(`🔢 散点数量: ${scatterCount} (大小: ${pointSize}px)`)
	console.log(`💾 输出文件: ${output}`)
	console.log('🔄 使用混合模式：无头浏览器渲染地图，Node.js WebGPU 渲染散点')

	// 有头模式配置 - 支持 WebGPU
	const launchOptions = {
		headless: false, // 关键：必须使用有头模式才能支持 WebGPU
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--enable-unsafe-webgpu', // 启用 WebGPU
			'--enable-gpu-rasterization',
			'--enable-features=Vulkan',
			'--use-angle=metal',
			'--ignore-gpu-blocklist',
			'--disable-gpu-sandbox',
			'--allow-file-access-from-files', // 允许访问本地文件
			'--window-size=1280,800',
		],
		defaultViewport: { width, height, deviceScaleFactor: dpr },
		slowMo: 50, // 稍微放慢便于观察渲染过程
	}

	let mapBrowser
	try {
		// 启动无头浏览器用于 OpenLayers 地图渲染
		console.log('🚀 启动无头浏览器用于 OpenLayers 地图渲染...')
		const headlessLaunchOptions = {
			headless: 'new',
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--enable-gpu-rasterization',
				'--disable-gpu',
				'--window-size=1280,800'
			],
			defaultViewport: { width, height, deviceScaleFactor: dpr }
		}
		
		try {
			mapBrowser = await puppeteer.launch({ ...headlessLaunchOptions, channel: 'chrome' })
		} catch (_) {
			const fallback = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
			mapBrowser = await puppeteer.launch({ ...headlessLaunchOptions, executablePath: fallback })
		}



		// 渲染地图（使用无头浏览器）
		console.log('🗺️  开始渲染 OpenLayers 地图（无头模式）...')
		const mapPath = await renderOL(mapBrowser, {
			width,
			height,
			dpr,
			centerLon,
			centerLat,
			zoom,
			tileUrl,
		})

		// 渲染散点（使用 Node.js WebGPU）
		console.log('✨ 开始渲染 WebGPU 散点（Node.js 模式）...')
		const scatterPath = await renderScatterNode({
			width,
			height,
			dpr,
			scatterCount,
			pointSize,
		})

		// 合成最终图像
		console.log('🎨 正在合成最终图像...')
		await sharp(mapPath)
			.composite([{ input: scatterPath }])
			.toFile(output)

		console.log(`🎉 合成完成！输出文件: ${output}`)
		
		// 显示文件信息
		const stats = fs.statSync(output)
		console.log(`📊 文件大小: ${(stats.size / 1024).toFixed(1)} KB`)
		
	} catch (error) {
		console.error('❌ 渲染过程出错:', error.message)
		throw error
	} finally {
		// 清理浏览器实例
		if (mapBrowser) {
			await mapBrowser.close()
		}
	}
}

async function renderOL(browser, { width, height, dpr, centerLon, centerLat, zoom, tileUrl }) {
	const page = await browser.newPage()
	page.on('console', (msg) => console.log('[OL]', msg.type(), msg.text()))
	page.on('pageerror', (err) => console.error('[OL ERROR]', err))
	page.on('requestfailed', (req) =>
		console.warn('[OL REQUEST FAILED]', req.url(), req.failure()?.errorText)
	)

	const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          html, body { margin:0; padding:0; }
          #map { width: ${width}px; height: ${height}px; }
          .ol-viewport { background: #f0f0f0; }
        </style>
      </head>
      <body>
        <div id="map"></div>
      </body>
    </html>
  `

	await page.setContent(html, { waitUntil: 'domcontentloaded' })
	await page.addStyleTag({ path: require.resolve('ol/ol.css') })
	await page.addScriptTag({ path: require.resolve('ol/dist/ol.js') })

	await page.evaluate(
		({ tileUrl, centerLon, centerLat, zoom }) => {
			const fromLonLat = ol.proj.fromLonLat
			const TileLayer = ol.layer.Tile
			const XYZ = ol.source.XYZ
			const View = ol.View
			const Map = ol.Map

			const tileSource = new XYZ({
				url: tileUrl,
				crossOrigin: 'anonymous',
				maxZoom: 19,
				attributions: '© OpenStreetMap contributors',
			})

			const map = new Map({
				target: 'map',
				layers: [new TileLayer({ source: tileSource })],
				view: new View({ center: fromLonLat([centerLon, centerLat]), zoom }),
			})

			window.__tilesLoading = 0
			window.__tilesLoadedCount = 0
			tileSource.on('tileloadstart', () => window.__tilesLoading++)
			tileSource.on('tileloadend', () => {
				window.__tilesLoading--
				window.__tilesLoadedCount++
			})
			tileSource.on('tileloaderror', () => window.__tilesLoading--)

			window.__renderComplete = false
			map.once('rendercomplete', () => (window.__renderComplete = true))
			map.updateSize()
			map.renderSync()
		},
		{ tileUrl, centerLon, centerLat, zoom }
	)

	try {
		await page.waitForFunction(
			() =>
				window.__renderComplete === true &&
				(window.__tilesLoading ?? 0) === 0 &&
				(window.__tilesLoadedCount ?? 0) > 0,
			{ timeout: 20000, polling: 200 }
		)
	} catch (_) {
		console.warn('[WARN] OL 渲染等待超时，继续截图用于诊断')
	}

	const out = 'ol-map.png'
	await page.screenshot({ path: out, type: 'png' })
	await page.close()
	console.log(`[OK] 地图已输出: ${out} (${width}x${height} @${dpr}x)`)
	return out
}

async function renderScatterNode({ width, height, dpr, scatterCount, pointSize }) {
	console.log('✨ 开始渲染 WebGPU 散点（Node.js 模式）...')
	
	try {
		// 设置 WebGPU 全局变量
		Object.assign(globalThis, globals)
		const navigator = { gpu: create([]) }
		
		// 获取适配器
		const adapter = await navigator.gpu.requestAdapter()
		if (!adapter) throw new Error('No WebGPU adapter')
		
		// 获取设备
		const device = await adapter.requestDevice({
			requiredLimits: {
				maxBufferSize: 128 * 1024 * 1024,
				maxStorageBufferBindingSize: 128 * 1024 * 1024
			}
		})
		
		// 创建 Canvas (离屏渲染)
		const canvas = createCanvas(width, height)
		const context = canvas.getContext('2d') // 用于最终输出
		
		// 创建 WebGPU 纹理用于渲染
		const texture = device.createTexture({
			size: { width, height },
			format: 'rgba8unorm',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
		})
		
		// 生成散点数据
		const positions = new Float32Array(scatterCount * 2)
		for (let i = 0; i < scatterCount; i++) {
			positions[i * 2] = (Math.random() * 2 - 1) * 0.95
			positions[i * 2 + 1] = (Math.random() * 2 - 1) * 0.95
		}
		
		// 创建缓冲区
		const posBuffer = device.createBuffer({
			size: positions.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		})
		device.queue.writeBuffer(posBuffer, 0, positions)
		
		// 参数缓冲区
		const sizeX = (2 * pointSize) / width
		const sizeY = (2 * pointSize) / height
		const paramsData = new Float32Array([sizeX, sizeY, width, height])
		const paramsBuffer = device.createBuffer({
			size: paramsData.byteLength,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		})
		device.queue.writeBuffer(paramsBuffer, 0, paramsData)
		
		// WebGPU 着色器代码
		const shaderCode = `
			struct VSOut {
				@builtin(position) pos: vec4<f32>,
				@location(0) color: vec3<f32>,
			};
			
			@group(0) @binding(0) var<storage, read> positions: array<vec2<f32>>;
			@group(0) @binding(1) var<uniform> params: vec4<f32>;
			
			@vertex
			fn vs(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VSOut {
				let center = positions[iid];
				var corner: vec2<f32>;
				switch (vid) {
					case 0: { corner = vec2<f32>(-1.0, -1.0); }
					case 1: { corner = vec2<f32>( 1.0, -1.0); }
					case 2: { corner = vec2<f32>(-1.0,  1.0); }
					case 3: { corner = vec2<f32>( 1.0,  1.0); }
					default: { corner = vec2<f32>(0.0, 0.0); }
				}
				let halfSize = vec2<f32>(params.x, params.y) * 0.5;
				let pos = center + corner * halfSize;
				var out: VSOut;
				out.pos = vec4<f32>(pos, 0.0, 1.0);
				
				// 基于索引的渐变颜色
				let colorFactor = f32(iid) / f32(arrayLength(&positions));
				out.color = vec3<f32>(0.1 + colorFactor * 0.7, 0.8, 1.0 - colorFactor * 0.5);
				
				return out;
			}
			
			@fragment
			fn fs(in: VSOut) -> @location(0) vec4<f32> {
				return vec4<f32>(in.color, 1.0);
			}
		`
		
		// 创建渲染管线
		const shaderModule = device.createShaderModule({ code: shaderCode })
		const pipeline = device.createRenderPipeline({
			layout: 'auto',
			vertex: { module: shaderModule, entryPoint: 'vs' },
			fragment: { 
				module: shaderModule, 
				entryPoint: 'fs', 
				targets: [{ format: 'rgba8unorm' }] 
			},
			primitive: { topology: 'triangle-strip' }
		})
		
		// 创建绑定组
		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: { buffer: posBuffer } },
				{ binding: 1, resource: { buffer: paramsBuffer } }
			]
		})
		
		// 创建输出缓冲区
		const outputBuffer = device.createBuffer({
			size: width * height * 4, // RGBA
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		})
		
		// 渲染命令
		const encoder = device.createCommandEncoder()
		const renderPass = encoder.beginRenderPass({
			colorAttachments: [{
				view: texture.createView(),
				loadOp: 'clear',
				clearValue: { r: 0, g: 0, b: 0, a: 0 }, // 透明背景
				storeOp: 'store'
			}]
		})
		renderPass.setPipeline(pipeline)
		renderPass.setBindGroup(0, bindGroup)
		renderPass.draw(4, scatterCount)
		renderPass.end()
		
		// 复制纹理到缓冲区
		encoder.copyTextureToBuffer(
			{ texture },
			{ buffer: outputBuffer, bytesPerRow: width * 4 },
			{ width, height }
		)
		
		device.queue.submit([encoder.finish()])
		
		// 读取渲染结果
		await outputBuffer.mapAsync(GPUMapMode.READ)
		const outputData = new Uint8Array(outputBuffer.getMappedRange())
		
		// 创建 ImageData 并绘制到 Canvas
		const imageData = context.createImageData(width, height)
		imageData.data.set(outputData)
		context.putImageData(imageData, 0, 0)
		
		// 保存为 PNG
		const out = 'webgpu-overlay.png'
		const buffer = canvas.toBuffer('image/png')
		fs.writeFileSync(out, buffer)
		
		// 清理
		outputBuffer.unmap()
		
		console.log(`✅ WebGPU 散点渲染完成: ${scatterCount} 个点`)
		console.log(`[OK] 散点已输出: ${out} (${width}x${height} @${dpr}x)`)
		return out
		
	} catch (error) {
		console.error('❌ WebGPU 渲染失败:', error.message)
		throw error
	}
}

// 运行主函数
renderComposite().catch((err) => {
	console.error('[ERROR] 合成输出失败:', err)
	process.exit(1)
})
