import puppeteer from 'puppeteer'

/**
 * 合并版脚本：在 Node.js 环境中通过 Puppeteer 完成
 * 1) OpenLayers 地图渲染（OSM 瓦片）
 * 2) WebGPU 散点图渲染
 * 支持三种模式：ol | webgpu | both
 */
async function renderWithPuppeteer() {
  const mode = (process.env.MODE || 'both').toLowerCase() // 'ol' | 'webgpu' | 'both'

  // 统一尺寸配置（兼容旧环境变量）
  const width = parseInt(process.env.WIDTH || process.env.OL_WIDTH || process.env.WG_WIDTH || '1024', 10)
  const height = parseInt(process.env.HEIGHT || process.env.OL_HEIGHT || process.env.WG_HEIGHT || '768', 10)
  const dpr = parseFloat(process.env.DPR || process.env.OL_DPR || process.env.WG_DPR || '2')

  // OL 参数
  const centerLon = parseFloat(process.env.LON || process.env.OL_LON || '116.4074')
  const centerLat = parseFloat(process.env.LAT || process.env.OL_LAT || '39.9042')
  const zoom = parseFloat(process.env.ZOOM || process.env.OL_ZOOM || '13')
  const tileUrl = process.env.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

  // WebGPU 散点参数
  const scatterCount = parseInt(process.env.SCATTER_COUNT || process.env.WG_COUNT || '800', 10)
  const pointSize = parseFloat(process.env.SCATTER_SIZE || process.env.WG_SIZE || '6')

  // 输出文件
  const output = process.env.OUTPUT || (mode === 'ol' ? 'ol-map.png' : mode === 'webgpu' ? 'webgpu-scatter.png' : 'ol-webgpu.png')

  // 启动选项：尽量使用系统 Chrome，开启 WebGPU 所需参数
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-unsafe-webgpu',
      '--enable-gpu-rasterization',
      '--use-angle=metal',
    ],
    defaultViewport: { width, height, deviceScaleFactor: dpr },
  }

  let browser
  try {
    browser = await puppeteer.launch({ ...launchOptions, channel: 'chrome' })
  } catch (_) {
    const fallback = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    try {
      browser = await puppeteer.launch({ ...launchOptions, executablePath: fallback })
    } catch (e) {
      throw new Error('无法启动 Chrome。请执行：npx puppeteer browsers install chrome\n原始错误：' + (e?.message || e))
    }
  }

  try {
    const page = await browser.newPage()
    page.on('console', (msg) => console.log('[PAGE]', msg.type(), msg.text()))
    page.on('pageerror', (err) => console.error('[PAGE ERROR]', err))
    page.on('requestfailed', (req) => console.warn('[REQUEST FAILED]', req.url(), req.failure()?.errorText))

    // 根据模式拼装页面内容（both 模式包含地图和散点 overlay）
    const html = /* html */ `
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>OL + WebGPU Render</title>
          ${mode !== 'webgpu' ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@latest/ol.css" />' : ''}
          <style>
            html, body { margin: 0; padding: 0; }
            body { background: ${mode === 'webgpu' ? '#fff' : '#fff'}; }
            #app { position: relative; width: ${width}px; height: ${height}px; }
            #map { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
            #overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; background: transparent; }
            .ol-viewport { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <div id="app">
            ${mode !== 'webgpu' ? '<div id="map"></div>' : ''}
            ${mode !== 'ol' ? '<canvas id="overlay" width="' + width + '" height="' + height + '"></canvas>' : ''}
          </div>
          ${mode !== 'webgpu' ? '<link rel="stylesheet" href="http://localhost:8000/node_modules/ol/ol.css" />' : ''}
          ${mode !== 'webgpu' ? '<script src="http://localhost:8000/node_modules/ol/dist/ol.js"></script>' : ''}
          <script>
            (function() {
              const MODE = ${JSON.stringify(mode)}
              const WIDTH = ${width}
              const HEIGHT = ${height}
              const CENTER = [${centerLon}, ${centerLat}]
              const ZOOM = ${zoom}
              const TILE_URL = ${JSON.stringify(tileUrl)}
              const COUNT = ${scatterCount}
              const POINT_SIZE = ${pointSize}
              const OVERLAY_TRANSPARENT = MODE === 'both'

              window.__renderComplete = false
              window.__tilesLoading = 0
              window.__scatterRendered = false

              // 地图初始化改为 Node 侧注入（保证 ol.js 已加载后再执行）

              async function runScatterIfNeeded() {
                if (MODE === 'ol') { return }
                const canvas = document.getElementById('overlay') || (() => {
                  const c = document.createElement('canvas')
                  c.width = WIDTH; c.height = HEIGHT
                  document.body.appendChild(c)
                  return c
                })()

                if (!('gpu' in navigator)) {
                  const ctx = canvas.getContext('2d')
                  // 背景：both 模式透明，其它模式为白色
                  if (!OVERLAY_TRANSPARENT) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, WIDTH, HEIGHT) }
                  ctx.fillStyle = '#0cf'
                  for (let i = 0; i < COUNT; i++) {
                    const x = Math.random() * WIDTH
                    const y = Math.random() * HEIGHT
                    ctx.beginPath(); ctx.arc(x, y, POINT_SIZE / 2, 0, Math.PI * 2); ctx.fill()
                  }
                  window.__scatterRendered = true
                  return
                }

                const adapter = await navigator.gpu.requestAdapter()
                if (!adapter) { throw new Error('无法获取 WebGPU 适配器') }
                const device = await adapter.requestDevice()

                const context = canvas.getContext('webgpu')
                if (!context) { throw new Error('无法获取 WebGPU CanvasContext') }
                const format = navigator.gpu.getPreferredCanvasFormat()
                context.configure({ device, format, alphaMode: 'premultiplied' })

                const positions = new Float32Array(COUNT * 2)
                for (let i = 0; i < COUNT; i++) {
                  const nx = (Math.random() * WIDTH) / WIDTH * 2 - 1
                  const ny = (Math.random() * HEIGHT) / HEIGHT * 2 - 1
                  positions[i * 2] = nx * 0.95
                  positions[i * 2 + 1] = ny * 0.95
                }

                const posBuffer = device.createBuffer({ size: positions.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST })
                device.queue.writeBuffer(posBuffer, 0, positions.buffer)

                const sizeX = (2 * POINT_SIZE) / WIDTH
                const sizeY = (2 * POINT_SIZE) / HEIGHT
                const paramsData = new Float32Array([sizeX, sizeY, WIDTH, HEIGHT])
                const paramsBuffer = device.createBuffer({ size: paramsData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
                device.queue.writeBuffer(paramsBuffer, 0, paramsData.buffer)

                const shader = [
                  'struct VSOut {',
                  '  @builtin(position) pos: vec4<f32>,',
                  '  @location(0) color: vec3<f32>,',
                  '};',
                  '',
                  '@group(0) @binding(0) var<storage, read> positions: array<vec2<f32>>;',
                  '@group(0) @binding(1) var<uniform> params: vec4<f32>; // sizeX, sizeY, width, height',
                  '',
                  '@vertex',
                  'fn vs(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VSOut {',
                  '  let center = positions[iid];',
                  '  var corner: vec2<f32>;',
                  '  switch (vid) {',
                  '    case 0: { corner = vec2<f32>(-1.0, -1.0); }',
                  '    case 1: { corner = vec2<f32>( 1.0, -1.0); }',
                  '    case 2: { corner = vec2<f32>(-1.0,  1.0); }',
                  '    case 3: { corner = vec2<f32>( 1.0,  1.0); }',
                  '    default: { corner = vec2<f32>(0.0, 0.0); }',
                  '  }',
                  '  let halfSize = vec2<f32>(params.x, params.y) * 0.5;',
                  '  let pos = center + corner * halfSize;',
                  '  var out: VSOut;',
                  '  out.pos = vec4<f32>(pos, 0.0, 1.0);',
                  '  out.color = vec3<f32>(0.1, 0.8, 1.0);',
                  '  return out;',
                  '}',
                  '',
                  '@fragment',
                  'fn fs(in: VSOut) -> @location(0) vec4<f32> {',
                  '  return vec4<f32>(in.color, 1.0);',
                  '}',
                ].join('\n')

                const module = device.createShaderModule({ code: shader })
                const pipeline = device.createRenderPipeline({
                  layout: 'auto',
                  vertex: { module, entryPoint: 'vs' },
                  fragment: { module, entryPoint: 'fs', targets: [{ format }] },
                  primitive: { topology: 'triangle-strip' },
                })

                const bindGroup = device.createBindGroup({
                  layout: pipeline.getBindGroupLayout(0),
                  entries: [
                    { binding: 0, resource: { buffer: posBuffer } },
                    { binding: 1, resource: { buffer: paramsBuffer } },
                  ],
                })

                const encoder = device.createCommandEncoder()
                const pass = encoder.beginRenderPass({
                  colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    clearValue: OVERLAY_TRANSPARENT ? { r: 0, g: 0, b: 0, a: 0 } : { r: 1, g: 1, b: 1, a: 1 },
                    storeOp: 'store',
                  }],
                })
                pass.setPipeline(pipeline)
                pass.setBindGroup(0, bindGroup)
                pass.draw(4, COUNT)
                pass.end()
                device.queue.submit([encoder.finish()])

                window.__scatterRendered = true
              }

              // 启动散点渲染（与地图并行）；等待条件在 Node 侧控制
              runScatterIfNeeded()
            })()
          </script>
        </body>
      </html>
    `

    await page.setContent(html, { waitUntil: 'networkidle2' })
    if (mode !== 'webgpu') {
      // 注入本地 ol.css 与 ol.js，避免外网加载失败
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      const olCssPath = require.resolve('ol/ol.css')
      const olJsPath = require.resolve('ol/dist/ol.js')
      await page.addStyleTag({ path: olCssPath })
      await page.addScriptTag({ path: olJsPath })

      // 完成后在页面中初始化地图
      await page.evaluate(({ centerLon, centerLat, zoom, tileUrl }) => {
        const fromLonLat = ol.proj.fromLonLat
        const TileLayer = ol.layer.Tile
        const XYZ = ol.source.XYZ
        const View = ol.View
        const Map = ol.Map

        window.__tilesLoading = 0
        window.__renderComplete = false

        const tileSource = new XYZ({
          url: tileUrl,
          maxZoom: 19,
          attributions: '© OpenStreetMap contributors'
        })

        const map = new Map({
          target: 'map',
          layers: [ new TileLayer({ source: tileSource }) ],
          view: new View({ center: fromLonLat([centerLon, centerLat]), zoom })
        })

        tileSource.on('tileloadstart', () => window.__tilesLoading++)
        tileSource.on('tileloadend', () => window.__tilesLoading--)
        tileSource.on('tileloaderror', () => window.__tilesLoading--)

        map.once('rendercomplete', () => { window.__renderComplete = true })
        map.updateSize(); map.renderSync()
        window.__olMap = map
      }, { centerLon, centerLat, zoom, tileUrl })
    }

    // 根据模式等待完成条件
    const timeout = parseInt(process.env.TIMEOUT || '20000', 10)
    if (mode === 'ol') {
      try {
        await page.waitForFunction(() => window.__renderComplete === true && (window.__tilesLoading ?? 0) === 0, { timeout, polling: 200 })
      } catch (_) {
        console.warn('[WARN] OL 渲染等待超时，仍尝试截图用于诊断')
      }
    } else if (mode === 'webgpu') {
      await page.waitForFunction(() => window.__scatterRendered === true, { timeout, polling: 200 })
    } else {
      // both
      try {
        await page.waitForFunction(() => window.__renderComplete === true && (window.__tilesLoading ?? 0) === 0 && window.__scatterRendered === true, { timeout, polling: 200 })
      } catch (_) {
        console.warn('[WARN] both 模式等待超时，仍尝试截图用于诊断')
      }
    }

    await page.screenshot({ path: output, type: 'png' })
    console.log(`[OK] 已输出截图: ${output} (${width}x${height} @${dpr}x) 模式=${mode}`)
  } finally {
    await browser.close()
  }
}

renderWithPuppeteer().catch((err) => {
  console.error('[ERROR] 合并渲染失败:', err)
  process.exit(1)
})