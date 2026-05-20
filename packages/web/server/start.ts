import { createServer } from "./index"
import { config } from "./config"

async function main() {
  const app = await createServer()

  app.listen(config.port, () => {
    console.log(`[server] 运行在 http://localhost:${config.port}`)
    console.log(`[server] 环境: ${config.nodeEnv}`)
    if (config.nodeEnv === "development") {
      console.log(`[server] 前端开发服务器请单独启动: npm run dev:client`)
    }
  })
}

main().catch((err) => {
  console.error("启动失败:", err)
  process.exit(1)
})
