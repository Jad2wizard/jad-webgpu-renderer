import { ref } from "vue"
import { ofetch } from "ofetch"
import { useMapStore } from "@/stores/map"
import { fetchProject } from "@/utils/api"

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  toolCalls?: { name: string; args: Record<string, unknown>; result?: string }[]
}

export function useChat(projectId: string) {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const currentSessionId = ref<string | null>(null)
  const mapStore = useMapStore()

  async function send(message: string) {
    messages.value.push({
      id: crypto.randomUUID(),
      role: "user",
      content: message,
    })

    isStreaming.value = true

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      toolCalls: [],
    }
    messages.value.push(assistantMsg)

    try {
      const response = await ofetch("/api/chat", {
        method: "POST",
        body: {
          projectId,
          sessionId: currentSessionId.value,
          message,
        },
        responseType: "stream",
      })

      const reader = (response as any).getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue

          try {
            const data = JSON.parse(line.slice(6))
            const event = data

            switch (event.type) {
              case "text":
                assistantMsg.content += event.content || ""
                break
              case "tool_call":
                assistantMsg.toolCalls!.push({
                  name: event.tool,
                  args: event.args || {},
                })
                break
              case "tool_result":
                const last = assistantMsg.toolCalls!.at(-1)
                if (last) last.result = event.result
                break
              case "config_changed": {
                const fresh = await fetchProject(projectId)
                mapStore.refreshFromConfig(fresh.project)
                break
              }
              case "done":
                currentSessionId.value = currentSessionId.value
                break
              case "error":
                assistantMsg.content += `\n\n> ⚠️ ${event.message}`
                break
            }
          } catch {
            // 跳过无法解析的事件
          }
        }
      }
    } catch (err: any) {
      assistantMsg.content += `\n\n> ❌ 请求失败：${err.message || err}`
    } finally {
      isStreaming.value = false
    }
  }

  async function loadSession(sessionId: string) {
    currentSessionId.value = sessionId
    // 从后端加载历史消息
    const result = await ofetch<any>(`/api/chat/sessions/${sessionId}`)
    messages.value = result.messages.reverse().map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
    }))
  }

  function reset() {
    messages.value = []
    currentSessionId.value = null
  }

  return { messages, isStreaming, currentSessionId, send, loadSession, reset }
}
