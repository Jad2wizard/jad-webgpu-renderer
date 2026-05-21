<template>
	<div class="w-80 bg-white border-l flex flex-col h-full">
		<!-- 头部 -->
		<div class="h-10 border-b flex items-center px-3 gap-2 shrink-0">
			<span class="text-sm font-semibold">AI 助手</span>
			<div class="flex-1" />
			<el-button text size="small" @click="handleNewChat">新建</el-button>
			<el-button text size="small" @click="$emit('close')">
				<el-icon><Close /></el-icon>
			</el-button>
		</div>

		<!-- 消息列表 -->
		<div ref="msgListRef" class="flex-1 overflow-y-auto p-3 space-y-3">
			<div
				v-for="msg in chat.messages.value"
				:key="msg.id"
				:class="[
					'max-w-[85%] rounded-lg px-3 py-2 text-sm',
					msg.role === 'user'
						? 'bg-blue-500 text-white ml-auto'
						: 'bg-gray-100 text-gray-800',
				]"
			>
				<!-- eslint-disable-next-line vue/no-v-html -->
				<div v-if="msg.role === 'assistant'" v-html="renderMarkdown(msg.content)" />
				<template v-else>{{ msg.content }}</template>

				<!-- 工具调用展示 -->
				<div v-if="msg.toolCalls?.length" class="mt-2 pt-2 border-t border-gray-200">
					<div
						v-for="tc in msg.toolCalls"
						:key="tc.name"
						class="text-xs text-gray-500 flex items-center gap-1"
					>
						<span class="text-green-500">✓</span>
						{{ tc.name }}
					</div>
				</div>
			</div>

			<!-- 流式输出中的光标 -->
			<div v-if="chat.isStreaming.value" class="text-xs text-gray-400">
				<el-icon class="is-loading"><Loading /></el-icon>
			</div>
		</div>

		<!-- 输入区 -->
		<div class="border-t p-2 shrink-0">
			<el-input
				v-model="input"
				type="textarea"
				:rows="2"
				placeholder="描述你想做的修改..."
				:disabled="chat.isStreaming.value"
				@keydown.enter.exact.prevent="handleSend"
			/>
			<el-button
				type="primary"
				size="small"
				class="w-full mt-2"
				:loading="chat.isStreaming.value"
				:disabled="!input.trim()"
				@click="handleSend"
			>
				发送
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { Close, Loading } from '@element-plus/icons-vue'
import { marked } from 'marked'
import { useChat } from '@/composables/useChat'

const props = defineProps<{
	projectId: string
}>()

defineEmits<{
	close: []
}>()

const chat = useChat(props.projectId)
const input = ref('')
const msgListRef = ref<HTMLDivElement | null>(null)

function renderMarkdown(text: string): string {
	if (!text) return ''
	return marked.parse(text, { breaks: true }) as string
}

async function handleSend() {
	const msg = input.value.trim()
	if (!msg || chat.isStreaming.value) return
	input.value = ''
	await chat.send(msg)
	await nextTick()
	// 滚动到底部
	if (msgListRef.value) {
		msgListRef.value.scrollTop = msgListRef.value.scrollHeight
	}
}

function handleNewChat() {
	chat.reset()
}

onMounted(() => {
	chat.restoreSession()
})
</script>
