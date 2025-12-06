import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())

// Create an MCP server instance factory
// We create a new server instance for each connection because McpServer maintains connection state
const createServer = () => {
	const server = new McpServer({
		name: 'mcp-server',
		version: '0.0.1',
	})

	server.tool(
		'render_scatter_map',
		'Render a scatter map to an image',
		{
			count: z.number().describe('Number of scatter points').default(100),
			color: z
				.array(z.number())
				.describe('Color of points [r,g,b,a]')
				.default([0.2, 0.6, 1, 0.8]),
			radius: z.number().describe('Radius of points').default(6),
			width: z.number().describe('Image width').default(1024),
			height: z.number().describe('Image height').default(768),
		},
		async ({ count, color, radius, width, height }) => {
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

			try {
				const page = await browser.newPage()
				await page.setViewport({ width, height, deviceScaleFactor: 2 })

				// Resolve path to map.iife.js relative to this file (packages/mcp/src/index.js)
				// map package is in packages/map, so we go up two levels: ../../map/dist/map.iife.js
				const mapIifePath = path.resolve(__dirname, '../../map/dist/map.iife.js')

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
        const data = generateRandomScatterData(${count})
        createScatterLayer(gmap, 'scatter-points', data, { 
            color: ${JSON.stringify(color)}, 
            radius: ${radius}, 
            highlightColor: [1,0.3,0.3,1], 
            highlightRadius: ${radius * 2} 
        })
        window.__renderComplete = true
      } catch (err) {
        console.error('渲染错误', err)
        window.__renderError = err && err.message ? err.message : String(err)
      }
    })
  </script>
</body>
</html>`

				const tempHtmlPath = `/tmp/scatter-map-render-${Date.now()}.html`
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

				const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false })
				const base64Image = screenshotBuffer.toString('base64')

				try {
					fs.unlinkSync(tempHtmlPath)
				} catch {}

				return {
					content: [
						{
							type: 'image',
							data: base64Image,
							mimeType: 'image/png',
						},
					],
				}
			} finally {
				if (browser) await browser.close()
			}
		}
	)

	return server
}

// Store transports by session ID
const transports = {}

app.get('/sse', async (req, res) => {
	console.log('New SSE connection request')

	// Create a new transport
	// The client will send messages to /messages?sessionId=...
	const transport = new SSEServerTransport('/messages', res)

	const sessionId = transport.sessionId
	transports[sessionId] = transport

	transport.onclose = () => {
		console.log(`Transport closed for session ${sessionId}`)
		delete transports[sessionId]
	}

	const server = createServer()
	await server.connect(transport)
	console.log(`Connected session ${sessionId}`)
})

app.post('/messages', async (req, res) => {
	const sessionId = req.query.sessionId
	if (!sessionId) {
		res.status(400).send('Missing sessionId')
		return
	}

	const transport = transports[sessionId]
	if (!transport) {
		res.status(404).send('Session not found')
		return
	}

	console.log(req.body)
	await transport.handlePostMessage(req, res, req.body)
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => {
	console.log(`MCP server running on http://localhost:${port}`)
	console.log(`SSE endpoint: http://localhost:${port}/sse`)
})
