<template>
	<div class="h-screen flex flex-col">
		<!-- 顶部栏 -->
		<header class="h-12 bg-white border-b flex items-center px-4 gap-4 shrink-0">
			<el-button text @click="router.push('/projects')">
				<el-icon><ArrowLeft /></el-icon>
			</el-button>
			<span class="font-semibold text-lg truncate">{{ projectName }}</span>
			<div class="flex-1" />
			<el-button
				:type="mapStore.chatPanelOpen ? 'primary' : 'default'"
				size="small"
				@click="mapStore.chatPanelOpen = !mapStore.chatPanelOpen"
			>
				💬 AI 助手
			</el-button>
		</header>

		<!-- 主体区域 -->
		<div class="flex-1 flex overflow-hidden">
			<!-- 左侧：图层面板 -->
			<LayerSidebar v-if="!mapStore.chatPanelOpen" class="shrink-0" />

			<!-- 中央：地图画布 -->
			<div ref="mapContainerRef" class="flex-1 relative bg-black">
				<MapCanvas :project-id="projectId" :map-container-ref="mapContainerRef" />
			</div>

			<!-- 右侧：对话面板 -->
			<ChatPanel
				v-if="mapStore.chatPanelOpen"
				:project-id="projectId"
				class="shrink-0"
				@close="mapStore.chatPanelOpen = false"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/map'
import { fetchProject } from '@/utils/api'
import MapCanvas from '@/components/map/MapCanvas.vue'
import LayerSidebar from '@/components/layers/LayerSidebar.vue'
import ChatPanel from '@/components/chat/ChatPanel.vue'

const route = useRoute()
const router = useRouter()
const mapStore = useMapStore()

const projectId = route.params.id as string
const projectName = ref('加载中...')
const mapContainerRef = ref<HTMLDivElement | null>(null)

onMounted(async () => {
	try {
		const data = await fetchProject(projectId)
		projectName.value = data.project.name
		mapStore.config = {
			version: 1,
			viewport: data.project.viewport,
			tile: data.project.tileConfig,
			layers: data.project.layers,
			interaction: { boxSelect: { enabled: true, key: 'ctrl' } },
		}
	} catch {
		projectName.value = '加载失败'
	}
})

onUnmounted(() => {
	mapStore.config = null
	mapStore.selectedLayerId = null
})
</script>
