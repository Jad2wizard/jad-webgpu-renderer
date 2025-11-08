import puppeteer from 'puppeteer'

/**
 * 使用 Puppeteer 在无头浏览器中启用 WebGPU 渲染散点并输出 PNG
 */
async function renderScatterWithWebGPU() {
  const width = parseInt(process.env.WG_WIDTH || '1024', 10)
  const height = parseInt(process.env.WG_HEIGHT || '768', 10)
  const count = parseInt(process.env.WG_COUNT || '800', 10)
  const pointSize = parseFloat(process.env.WG_SIZE || '6') // 像素大小
  const output = process.env.WG_OUTPUT || 'webgpu-scatter.png'
  const dpr = parseFloat(process.env.WG_DPR || '2')

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
    const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    browser = await puppeteer.launch({ ...launchOptions, executablePath: macChromePath })
  }

  try {
    const page = await browser.newPage()
    page.on('console', (msg) => console.log('[PAGE]', msg.type(), msg.text()))
    page.on('pageerror', (err) => console.error('[PAGE ERROR]', err))
    page.on('requestfailed', (req) => console.warn('[REQUEST FAILED]', req.url(), req.failure()?.errorText))

    await page.goto('about:blank')
    await page.evaluate(({ width, height, count, pointSize }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      document.body.style.margin = '0'
      document.body.style.padding = '0'
      document.body.style.background = '#fff'
      document.body.appendChild(canvas)

      const run = async () => {
        // Fallback: Canvas2D
        if (!('gpu' in navigator)) {
          const ctx = canvas.getContext('2d')
          // 背景设为白色
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          // 绘制散点
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
        const format = navigator.gpu.getPreferredCanvasFormat()
        if (!context) { throw new Error('无法获取 WebGPU CanvasContext') }
        context.configure({ device, format, alphaMode: 'premultiplied' })

        const positions = new Float32Array(count * 2)
        for (let i = 0; i < count; i++) {
          const nx = (Math.random() * width) / width * 2 - 1
          const ny = (Math.random() * height) / height * 2 - 1
          positions[i * 2] = nx * 0.95
          positions[i * 2 + 1] = ny * 0.95
        }

        const posBuffer = device.createBuffer({
          size: positions.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
        device.queue.writeBuffer(posBuffer, 0, positions.buffer)

        const sizeX = (2 * pointSize) / width
        const sizeY = (2 * pointSize) / height
        const paramsData = new Float32Array([sizeX, sizeY, width, height])
        const paramsBuffer = device.createBuffer({
          size: paramsData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
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
            // 背景设为白色
            clearValue: { r: 1, g: 1, b: 1, a: 1 },
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
    }, { width, height, count, pointSize })
    await page.waitForFunction(() => window.__scatterRendered === true, { timeout: 20000, polling: 200 })
    await page.screenshot({ path: output, type: 'png' })
    console.log(`[OK] WebGPU 散点已输出: ${output} (${width}x${height} @${dpr}x)`) 
  } finally {
    await browser.close()
  }
}

renderScatterWithWebGPU().catch((err) => {
  console.error('[ERROR] WebGPU 散点渲染失败:', err)
  process.exit(1)
})
