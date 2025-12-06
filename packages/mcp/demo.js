import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function renderScatterMap() {
	const width = 1024
	const height = 768
	const output = 'scatter-map-demo.png'

	let browser
	try {
		browser = await puppeteer.launch({
			headless: false,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--enable-unsafe-webgpu',
				'--enable-features=WebGPU',
				'--disable-webgpu-blocklist',
			],
		})
	} catch {
		const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
		if (process.platform === 'darwin' && fs.existsSync(chromePath)) {
			browser = await puppeteer.launch({
				headless: false,
				executablePath: chromePath,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--enable-unsafe-webgpu',
					'--enable-features=WebGPU',
					'--disable-webgpu-blocklist',
				],
			})
		} else {
			throw new Error('Puppeteer 无法启动浏览器')
		}
	}

	const page = await browser.newPage()
	await page.setViewport({ width, height, deviceScaleFactor: 2 })

	const mapIifePath = path.resolve(__dirname, '../map/dist/map.iife.js')
	const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GMap Scatter Demo</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden}#map-container{width:100vw;height:100vh;position:relative}
  </style>
  <script src="file://${mapIifePath}"></script>
</head>
<body>
  <div id="map-container"></div>
	  <script>
	    window.addEventListener('load', async function() {
	      try {
	        if (typeof GMap === 'undefined') throw new Error('GMap 未加载')
	        const tileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
	        const { GMap: GMapClass, createTileLayer, generateRandomScatterData, createScatterLayer } = GMap
	        const container = document.getElementById('map-container')
	        const gmap = new GMapClass({ container, tileLayer: createTileLayer(tileUrlTemplate) })
	        const data = generateRandomScatterData(100)
	        createScatterLayer(gmap, 'scatter-points', data, { color: [0.2,0.6,1,0.8], radius: 6, highlightColor: [1,0.3,0.3,1], highlightRadius: 12 })
	        window.__renderComplete = true
	      } catch (err) {
	        console.error('渲染错误', err)
	        window.__renderError = err && err.message ? err.message : String(err)
	      }
	    })
	  </script>
</body>
</html>`

	const tempHtmlPath = `/tmp/scatter-map-demo-${Date.now()}.html`
	fs.writeFileSync(tempHtmlPath, html)
	const fileUrl = `file://${tempHtmlPath}`
	await page.goto(fileUrl, { waitUntil: 'networkidle0' })
	await page.waitForFunction(
		() => window.__renderComplete === true || window.__renderError !== undefined,
		{ timeout: 30000 }
	)
	const result = await page.evaluate(() => ({
		success: window.__renderComplete || false,
		error: window.__renderError || null,
	}))
	if (!result.success) throw new Error('渲染失败: ' + result.error)
	await page.screenshot({ path: output, type: 'png', fullPage: false })
	try {
		fs.unlinkSync(tempHtmlPath)
	} catch {}
	await browser.close()
	console.log(output)
}

renderScatterMap().catch((e) => {
	console.error('执行失败', e)
	process.exit(1)
})
