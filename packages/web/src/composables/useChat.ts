import { ref } from 'vue'
import { useMapStore } from '@/stores/map'
import { fetchProject, fetchChatMessages, fetchChatSessions } from '@/utils/api'

const apiBase = '/api'
const SESSION_KEY = 'chat_current_session'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function authHeaders(): Record<string, string> {
	const token = localStorage.getItem('token')
	return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface ChatMessage {
	id: string
	role: 'user' | 'assistant' | 'tool'
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
			role: 'user',
			content: message,
		})

		isStreaming.value = true

		const rawAssistantMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			toolCalls: [],
		}
		messages.value.push(rawAssistantMsg)
		// 获取被 Vue 代理后的响应式对象
		const assistantMsg = messages.value[messages.value.length - 1]

		let finished = false
		let errorMsg: string | null = null

		try {
			const response = await fetch(`${apiBase}/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...authHeaders(),
				},
				body: JSON.stringify({
					projectId,
					sessionId: currentSessionId.value,
					message,
				}),
			})

			if (!response.ok) {
				const text = await response.text()
				try {
					const err = JSON.parse(text)
					if (err.error) errorMsg = err.error
				} catch (e) {
					errorMsg = `HTTP ${response.status}`
				}
				throw new Error(errorMsg || '请求失败')
			}

			if (!response.body) {
				throw new Error('ReadableStream not supported')
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder('utf-8')
			let buffer = ''

			let doneReading = false
			while (!doneReading) {
				const { done, value } = await reader.read()
				if (done) {
					doneReading = true
					break
				}

				await delay(100)

				buffer += decoder.decode(value, { stream: true })

				// 解析 SSE 格式
				const lines = buffer.split('\n')
				// 保留最后一行未完整的部分
				buffer = lines.pop() || ''

				let currentEvent = 'message'

				for (const line of lines) {
					if (line.trim() === '') continue

					if (line.startsWith('event:')) {
						currentEvent = line.slice(6).trim()
					} else if (line.startsWith('data:')) {
						const dataStr = line.slice(5).trim()
						if (!dataStr) continue

						try {
							const event = JSON.parse(dataStr)
							switch (currentEvent) {
								case 'text':
									assistantMsg.content += event.content || ''
									break
								case 'tool_call':
									assistantMsg.toolCalls!.push({
										name: event.tool,
										args: event.args || {},
									})
									break
								case 'tool_result': {
									const last = assistantMsg.toolCalls!.at(-1)
									if (last) last.result = event.result
									break
								}
								case 'config_changed': {
									fetchProject(projectId)
										.then(async (fresh) => {
											const p = fresh.project
											await mapStore.refreshFromConfig({
												version: 1,
												viewport: p.viewport,
												tile: p.tileConfig,
												layers: p.layers,
												interaction: {
													boxSelect: { enabled: true, key: 'ctrl' },
												},
											})
										})
										.catch(() => {})
									break
								}
								case 'done':
									finished = true
									if (event.sessionId) {
										currentSessionId.value = event.sessionId
										localStorage.setItem(
											`${SESSION_KEY}_${projectId}`,
											event.sessionId
										)
									}
									break
								case 'error':
									assistantMsg.content += `\n\n> ⚠️ ${event.message}`
									break
							}
						} catch {
							// 解析 JSON 失败
						}
					}
				}
			}
			finished = true
		} catch (err: any) {
			errorMsg = errorMsg || err.message || String(err)
		} finally {
			isStreaming.value = false
			if (!finished && errorMsg) {
				assistantMsg.content += `\n\n> ❌ 请求失败：${errorMsg}`
			}
		}
	}

	async function loadSession(sessionId: string) {
		currentSessionId.value = sessionId
		localStorage.setItem(`${SESSION_KEY}_${projectId}`, sessionId)
		const result = await fetchChatMessages(sessionId)
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
		localStorage.removeItem(`${SESSION_KEY}_${projectId}`)
	}

	async function restoreSession() {
		const persistedId = localStorage.getItem(`${SESSION_KEY}_${projectId}`)
		if (persistedId) {
			try {
				await loadSession(persistedId)
				return
			} catch {
				localStorage.removeItem(`${SESSION_KEY}_${projectId}`)
			}
		}
		try {
			const { sessions } = await fetchChatSessions(projectId)
			if (sessions.length > 0) {
				await loadSession(sessions[0].id)
			}
		} catch {
			// 获取会话列表失败，忽略
		}
	}

	return { messages, isStreaming, currentSessionId, send, loadSession, reset, restoreSession }
}
