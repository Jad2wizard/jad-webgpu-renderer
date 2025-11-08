import puppeteer from 'puppeteer'
import { createRequire } from 'module'
import sharp from 'sharp'
const require = createRequire(import.meta.url)

/**
 * 组合实现：分别用 Puppeteer 渲染 OpenLayers 地图与 WebGPU 散点，再进行图像叠加合成。
 * - 解决单页同时加载 OL 与 WebGPU 的不稳定问题（CDN/script 注入警告、解析错误等）。
 * - 兼容离线环境：优先使用本地 node_modules 资源加载 OL；散点不依赖外网。
 */
async function renderComposite() {
  // 通用配置
  const width = parseInt(process.env.WIDTH || process.env.OL_WIDTH || process.env.WG_WIDTH || '1024', 10)
  const height = parseInt(process.env.HEIGHT || process.env.OL_HEIGHT || process.env.WG_HEIGHT || '768', 10)
  const dpr = parseFloat(process.env.DPR || process.env.OL_DPR || process.env.WG_DPR || '2')
  const output = process.env.OUTPUT || 'ol-webgpu.png'

  // 地图参数
  const centerLon = parseFloat(process.env.LON || process.env.OL_LON || '116.4074')
  const centerLat = parseFloat(process.env.LAT || process.env.OL_LAT || '39.9042')
  const zoom = parseFloat(process.env.ZOOM || process.env.OL_ZOOM || '13')
  const tileUrl = process.env.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

  // 散点参数
  const scatterCount = parseInt(process.env.SCATTER_COUNT || process.env.WG_COUNT || '800', 10)
  const pointSize = parseFloat(process.env.SCATTER_SIZE || process.env.WG_SIZE || '6')

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
    browser = await puppeteer.launch({ ...launchOptions, executablePath: fallback })
  }

  try {
    const mapPath = await renderOL(browser, { width, height, dpr, centerLon, centerLat, zoom, tileUrl })
    const scatterPath = await renderScatter(browser, { width, height, dpr, scatterCount, pointSize })
    // 合成：将散点叠加到地图上
    await sharp(mapPath)
      .composite([{ input: scatterPath }])
      .toFile(output)
    console.log(`[OK] 合成完成: ${output} (${width}x${height} @${dpr}x)`) 
  } finally {
    await browser.close()
  }
}

async function renderOL(browser, { width, height, dpr, centerLon, centerLat, zoom, tileUrl }) {
  const page = await browser.newPage()
  page.on('console', (msg) => console.log('[OL]', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.error('[OL ERROR]', err))
  page.on('requestfailed', (req) => console.warn('[OL REQUEST FAILED]', req.url(), req.failure()?.errorText))

  // 生成占位瓦片（灰色背景），用于离线或网络不可用时兜底
  const placeholderTile = await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .png()
    .toBuffer()

  // 计算瓦片主机名（用于拦截 OSM 瓦片请求）
  const targetHost = (() => {
    try {
      const u = new URL(tileUrl.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0'))
      return u.host
    } catch {
      return 'tile.openstreetmap.org'
    }
  })()

  // 默认不拦截瓦片请求，允许加载真实地图；仅在 OFFLINE=1 时启用占位兜底
  if (process.env.OFFLINE === '1') {
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes(targetHost) && url.endsWith('.png')) {
        return req.respond({
          status: 200,
          contentType: 'image/png',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: placeholderTile,
        })
      }
      return req.continue()
    })
  }

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

  // 避免因瓦片加载导致 networkidle2 长时间不触发，改用 domcontentloaded
  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  // 注入本地 OL 样式与 UMD 脚本，避免依赖本地 HTTP 服务器
  await page.addStyleTag({ path: require.resolve('ol/ol.css') })
  await page.addScriptTag({ path: require.resolve('ol/dist/ol.js') })
  // 初始化地图（使用 UMD 全局对象 ol）
  await page.evaluate(({ tileUrl, centerLon, centerLat, zoom }) => {
    const fromLonLat = ol.proj.fromLonLat
    const TileLayer = ol.layer.Tile
    const XYZ = ol.source.XYZ
    const View = ol.View
    const Map = ol.Map

    const tileSource = new XYZ({
      url: tileUrl,
      crossOrigin: 'anonymous',
      maxZoom: 19,
      attributions: '© OpenStreetMap contributors'
    })

    const map = new Map({
      target: 'map',
      layers: [ new TileLayer({ source: tileSource }) ],
      view: new View({ center: fromLonLat([centerLon, centerLat]), zoom })
    })

    // 统计瓦片加载情况
    // @ts-ignore
    window.__tilesLoading = 0
    // @ts-ignore
    window.__tilesLoadedCount = 0
    tileSource.on('tileloadstart', () => { /* @ts-ignore */ window.__tilesLoading++ })
    tileSource.on('tileloadend', () => { /* @ts-ignore */ window.__tilesLoading--; /* @ts-ignore */ window.__tilesLoadedCount++ })
    tileSource.on('tileloaderror', () => { /* @ts-ignore */ window.__tilesLoading-- })

    // @ts-ignore
    window.__renderComplete = false
    map.once('rendercomplete', () => { /* @ts-ignore */ window.__renderComplete = true })
    map.updateSize(); map.renderSync()
  }, { tileUrl, centerLon, centerLat, zoom })
  try {
    await page.waitForFunction(() => window.__renderComplete === true && (window.__tilesLoading ?? 0) === 0 && (window.__tilesLoadedCount ?? 0) > 0, { timeout: 20000, polling: 200 })
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

  await page.goto('about:blank')
  await page.evaluate(({ width, height, count, pointSize }) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    document.body.style.background = 'transparent'
    document.body.appendChild(canvas)

    const run = async () => {
      if (!('gpu' in navigator)) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#0cf'
        for (let i = 0; i < count; i++) {
          const x = Math.random() * canvas.width
          const y = Math.random() * canvas.height
          ctx.beginPath(); ctx.arc(x, y, pointSize / 2, 0, Math.PI * 2); ctx.fill()
        }
        // @ts-ignore
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

      const positions = new Float32Array(count * 2)
      for (let i = 0; i < count; i++) {
        const nx = (Math.random() * width) / width * 2 - 1
        const ny = (Math.random() * height) / height * 2 - 1
        positions[i * 2] = nx * 0.95
        positions[i * 2 + 1] = ny * 0.95
      }

      const posBuffer = device.createBuffer({ size: positions.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST })
      device.queue.writeBuffer(posBuffer, 0, positions.buffer)

      const sizeX = (2 * pointSize) / width
      const sizeY = (2 * pointSize) / height
      const paramsData = new Float32Array([sizeX, sizeY, width, height])
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
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: 'store',
        }],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(4, count)
      pass.end()
      device.queue.submit([encoder.finish()])

      // @ts-ignore
      window.__scatterRendered = true
    }

    run().catch((e) => { console.error('WebGPU 渲染失败:', e); /* @ts-ignore */ window.__scatterRendered = false })
  }, { width, height, count: scatterCount, pointSize })

  await page.waitForFunction(() => window.__scatterRendered === true, { timeout: 20000, polling: 200 })
  const out = 'webgpu-overlay.png'
  await page.screenshot({ path: out, type: 'png', omitBackground: true })
  await page.close()
  console.log(`[OK] 散点已输出: ${out} (${width}x${height} @${dpr}x)`) 
  return out
}

renderComposite().catch((err) => {
  console.error('[ERROR] 合并输出失败:', err)
  process.exit(1)
})