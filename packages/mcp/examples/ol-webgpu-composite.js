import puppeteer from 'puppeteer'
import { createRequire } from 'module'
import sharp from 'sharp'
import fs from 'fs'
const require = createRequire(import.meta.url)

/**
 * 最终版：OpenLayers + WebGPU 散点合成渲染器
 *
 * 功能特点：
 * 1. 使用 Puppeteer 有头模式确保 WebGPU 支持
 * 2. 禁用自动化检测绕过 WebGPU 限制
 * 3. 分别渲染 OpenLayers 地图和 WebGPU 散点
 * 4. 使用本地 HTML 文件确保干净的散点渲染环境
 * 5. 生成透明背景的散点图片用于合成
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

	console.log('🎯 OpenLayers + WebGPU 合成渲染器')
	console.log(`📐 尺寸: ${width}x${height} @${dpr}x`)
	console.log(`🗺️  地图中心: ${centerLon}, ${centerLat} (缩放: ${zoom})`)
	console.log(`🔢 散点数量: ${scatterCount} (大小: ${pointSize}px)`)
	console.log(`💾 输出文件: ${output}`)

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

	let browser
	try {
		// 启动浏览器
		try {
			browser = await puppeteer.launch({ ...launchOptions, channel: 'chrome' })
		} catch (_) {
			const fallback =
				process.env.CHROME_PATH ||
				'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
			browser = await puppeteer.launch({ ...launchOptions, executablePath: fallback })
		}

		console.log('🚀 浏览器启动成功，正在配置 WebGPU 支持...')

		// 渲染地图
		console.log('🗺️  开始渲染 OpenLayers 地图...')
		const mapPath = await renderOL(browser, {
			width,
			height,
			dpr,
			centerLon,
			centerLat,
			zoom,
			tileUrl,
		})

		// 渲染散点
		console.log('✨ 开始渲染 WebGPU 散点...')
		const scatterPath = await renderScatter(browser, {
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
	} finally {
		if (browser) {
			await browser.close()
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

async function renderScatter(browser, { width, height, dpr, scatterCount, pointSize }) {
	const page = await browser.newPage()
	page.on('console', (msg) => console.log('[WG]', msg.type(), msg.text()))
	page.on('pageerror', (err) => console.error('[WG ERROR]', err))

	// 关键：禁用自动化检测以确保 WebGPU 可用
	await page.evaluateOnNewDocument(() => {
		Object.defineProperty(navigator, 'webdriver', {
			get: () => undefined,
			set: () => {},
			configurable: true,
		})

		// 确保有正常的 Chrome 环境
		window.chrome = window.chrome || {
			runtime: {},
			loadTimes: () => ({}),
			csi: () => ({}),
		}
	})

	// 创建临时 HTML 文件以确保干净的渲染环境
	const tempHtmlPath = `/tmp/webgpu-scatter-${Date.now()}.html`

	const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>WebGPU Scatter Renderer</title>
    <style>
        * { margin: 0; padding: 0; }
        body { background: transparent; overflow: hidden; }
        #canvas-container {
            width: ${width}px;
            height: ${height}px;
            position: relative;
            background: transparent;
        }
        canvas { display: block; background: transparent; }
    </style>
</head>
<body>
    <div id="canvas-container">
        <canvas id="scatter-canvas" width="${width}" height="${height}"></canvas>
    </div>
    
    <script>
        async function renderScatter() {
            const canvas = document.getElementById('scatter-canvas');
            const width = ${width};
            const height = ${height};
            const count = ${scatterCount};
            const pointSize = ${pointSize};
            
            try {
                // 1. 检测 WebGPU
                if (!navigator.gpu) throw new Error('WebGPU not supported');
                
                // 2. 获取适配器
                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) throw new Error('No WebGPU adapter');
                
                // 3. 获取设备
                const device = await adapter.requestDevice({
                    requiredLimits: {
                        maxBufferSize: 128 * 1024 * 1024,
                        maxStorageBufferBindingSize: 128 * 1024 * 1024
                    }
                });
                
                // 4. 获取上下文
                const context = canvas.getContext('webgpu');
                if (!context) throw new Error('No WebGPU context');
                
                // 5. 配置上下文
                const format = navigator.gpu.getPreferredCanvasFormat();
                context.configure({ device, format, alphaMode: 'premultiplied' });
                
                // 6. 生成散点数据
                const positions = new Float32Array(count * 2);
                for (let i = 0; i < count; i++) {
                    positions[i * 2] = (Math.random() * 2 - 1) * 0.95;
                    positions[i * 2 + 1] = (Math.random() * 2 - 1) * 0.95;
                }
                
                // 7. 创建缓冲区
                const posBuffer = device.createBuffer({
                    size: positions.byteLength,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
                });
                device.queue.writeBuffer(posBuffer, 0, positions);
                
                // 8. 参数缓冲区
                const sizeX = (2 * pointSize) / width;
                const sizeY = (2 * pointSize) / height;
                const paramsData = new Float32Array([sizeX, sizeY, width, height]);
                const paramsBuffer = device.createBuffer({
                    size: paramsData.byteLength,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
                });
                device.queue.writeBuffer(paramsBuffer, 0, paramsData);
                
                // 9. 着色器 - 带渐变颜色
                const shader = \`
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
                \`;
                
                // 10. 渲染管线
                const module = device.createShaderModule({ code: shader });
                const pipeline = device.createRenderPipeline({
                    layout: 'auto',
                    vertex: { module, entryPoint: 'vs' },
                    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
                    primitive: { topology: 'triangle-strip' }
                });
                
                // 11. 绑定组
                const bindGroup = device.createBindGroup({
                    layout: pipeline.getBindGroupLayout(0),
                    entries: [
                        { binding: 0, resource: { buffer: posBuffer } },
                        { binding: 1, resource: { buffer: paramsBuffer } }
                    ]
                });
                
                // 12. 渲染 - 透明背景
                const encoder = device.createCommandEncoder();
                const pass = encoder.beginRenderPass({
                    colorAttachments: [{
                        view: context.getCurrentTexture().createView(),
                        loadOp: 'clear',
                        clearValue: { r: 0, g: 0, b: 0, a: 0 }, // 透明背景
                        storeOp: 'store'
                    }]
                });
                pass.setPipeline(pipeline);
                pass.setBindGroup(0, bindGroup);
                pass.draw(4, count);
                pass.end();
                device.queue.submit([encoder.finish()]);
                
                // 标记完成
                window.__scatterRendered = true;
                window.__renderInfo = {
                    success: true,
                    count: count,
                    format: format,
                    dimensions: { width, height }
                };
                
            } catch (error) {
                window.__scatterRendered = false;
                window.__renderError = error.message;
                console.error('WebGPU 渲染失败:', error);
            }
        }
        
        // 运行渲染
        renderScatter();
    </script>
</body>
</html>`

	// 保存 HTML 文件
	fs.writeFileSync(tempHtmlPath, htmlContent)
	console.log('✅ 临时 HTML 文件已创建')

	try {
		// 访问本地 HTML 文件
		const fileUrl = `file://${tempHtmlPath}`
		console.log('🌐 访问本地文件:', fileUrl)
		await page.goto(fileUrl, { waitUntil: 'domcontentloaded' })

		// 等待渲染完成
		console.log('⏳ 等待 WebGPU 渲染完成...')
		await page.waitForFunction(
			() => window.__scatterRendered === true || window.__renderError !== undefined,
			{ timeout: 30000, polling: 200 }
		)

		// 检查结果
		const result = await page.evaluate(() => ({
			success: window.__scatterRendered || false,
			info: window.__renderInfo || null,
			error: window.__renderError || null,
		}))

		if (!result.success) {
			throw new Error(`WebGPU 渲染失败: ${result.error}`)
		}

		console.log('✅ WebGPU 渲染完成:', result.info)

		// 截图 - 只截取 Canvas 元素
		console.log('📸 截取散点图片...')
		const canvasElement = await page.$('#scatter-canvas')
		const out = 'webgpu-overlay.png'
		await canvasElement.screenshot({
			path: out,
			type: 'png',
			omitBackground: true, // 关键：透明背景
		})

		console.log(`[OK] 散点已输出: ${out} (${width}x${height} @${dpr}x)`)
		return out
	} finally {
		await page.close()
		// 清理临时文件
		try {
			fs.unlinkSync(tempHtmlPath)
			console.log('🧹 临时文件已清理')
		} catch (e) {}
	}
}

// 运行主函数
renderComposite().catch((err) => {
	console.error('[ERROR] 合成输出失败:', err)
	process.exit(1)
})
