import puppeteer from 'puppeteer'

/**
 * 使用 Puppeteer 在 Node.js 中渲染 OpenLayers 地图并输出 PNG
 */
async function renderOpenLayersMap() {
	// 输出配置
	const width = parseInt(process.env.OL_WIDTH || '1024', 10)
	const height = parseInt(process.env.OL_HEIGHT || '768', 10)
	const centerLon = parseFloat(process.env.OL_LON || '116.4074') // 北京经度
	const centerLat = parseFloat(process.env.OL_LAT || '39.9042') // 北京纬度
	const zoom = parseFloat(process.env.OL_ZOOM || '13')
	const output = process.env.OL_OUTPUT || 'ol-map.png'
	const dpr = parseFloat(process.env.OL_DPR || '2')

	const commonLaunchOptions = {
		headless: 'new',
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
		defaultViewport: { width, height, deviceScaleFactor: dpr },
	}

	// 首选使用系统 Chrome（无需单独下载 Chromium）
	let browser
	try {
		browser = await puppeteer.launch({ ...commonLaunchOptions, channel: 'chrome' })
	} catch (_) {
		// macOS 常见路径作为兜底
		const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
		try {
			browser = await puppeteer.launch({
				...commonLaunchOptions,
				executablePath: macChromePath,
			})
		} catch (e) {
			// 如果还是失败，提示安装 Puppeteer 浏览器资源
			throw new Error(
				'无法找到可用的 Chrome/Chromium。请先执行：npx puppeteer browsers install chrome\n原始错误：' +
					(e?.message || e)
			)
		}
	}

	try {
		const page = await browser.newPage()
		// 捕获页面日志与错误，便于诊断空白截图问题
		page.on('console', (msg) => console.log('[PAGE]', msg.type(), msg.text()))
		page.on('pageerror', (err) => console.error('[PAGE ERROR]', err))
		page.on('requestfailed', (req) =>
			console.warn('[REQUEST FAILED]', req.url(), req.failure()?.errorText)
		)

		// 页面 HTML：引入 OpenLayers CDN 并渲染 OSM 瓦片图层
		const html = /* html */ `
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>OpenLayers Headless Render</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@latest/ol.css" />
          <style>
            html, body { margin: 0; padding: 0; }
            #map { width: ${width}px; height: ${height}px; }
            /* 让地图背景更清晰 */
            .ol-viewport { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://cdn.jsdelivr.net/npm/ol@latest/dist/ol.js"></script>
          <script>
            (function() {
              const fromLonLat = ol.proj.fromLonLat
              const TileLayer = ol.layer.Tile
              const XYZ = ol.source.XYZ
              const View = ol.View
              const Map = ol.Map

              const tileSource = new XYZ({
                url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                maxZoom: 19,
                attributions: '© OpenStreetMap contributors'
              })

              const map = new Map({
                target: 'map',
                layers: [ new TileLayer({ source: tileSource }) ],
                view: new View({
                  center: fromLonLat([${centerLon}, ${centerLat}]),
                  zoom: ${zoom}
                })
              })

              // 简单的瓦片加载就绪标记
              window.__tilesLoading = 0
              tileSource.on('tileloadstart', () => window.__tilesLoading++)
              tileSource.on('tileloadend', () => window.__tilesLoading--)
              tileSource.on('tileloaderror', () => window.__tilesLoading--)

              // 渲染完成标记
              window.__renderComplete = false
              map.once('rendercomplete', () => { window.__renderComplete = true })

              // 确保尺寸与渲染立即生效
              map.updateSize()
              map.renderSync()

              // 暴露 map 以便调试
              window.__olMap = map
            })()
          </script>
        </body>
      </html>
    `

		await page.setContent(html, { waitUntil: 'networkidle2' })
		await page.waitForSelector('.ol-viewport', { timeout: 10000 })

		// 等待渲染完成与瓦片加载完成（双条件）或超时
		try {
			await page.waitForFunction(
				() => window.__renderComplete === true && (window.__tilesLoading ?? 0) === 0,
				{ timeout: 15000, polling: 200 }
			)
		} catch (_) {
			// 若超时，仍尝试截图（可用于诊断）
			console.warn('[WARN] 等待渲染与瓦片加载超时，仍输出截图用于诊断')
		}

		// 截图输出
		await page.screenshot({ path: output, type: 'png' })
		console.log(`[OK] 已输出截图: ${output} (${width}x${height} @${dpr}x)`)
	} finally {
		await browser.close()
	}
}

renderOpenLayersMap().catch((err) => {
	console.error('[ERROR] OpenLayers 渲染失败:', err)
	process.exit(1)
})
