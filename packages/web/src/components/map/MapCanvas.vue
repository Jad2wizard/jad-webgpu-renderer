<template>
  <div ref="el" class="w-full h-full relative">
    <!-- WebGPU canvas will be inserted here by GMap -->
    <div v-if="!ready" class="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
      <el-icon class="is-loading text-white text-2xl"><Loading /></el-icon>
      <span class="text-white ml-2">初始化 WebGPU...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue"
import { Loading } from "@element-plus/icons-vue"
import { useMapStore } from "@/stores/map"
import { useGMap } from "@/composables/useGMap"

const props = defineProps<{
  projectId: string
  mapContainerRef: HTMLDivElement | null
}>()

const mapStore = useMapStore()
const { initMap, dispose } = useGMap()

const el = ref<HTMLDivElement | null>(null)
const ready = ref(false)

// 当配置加载完毕后初始化地图
watch(
  () => mapStore.config,
  async (config) => {
    if (config && el.value) {
      try {
        await initMap(el.value, config)
        ready.value = true
      } catch (err) {
        console.error("Map init failed:", err)
      }
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  dispose()
})
</script>
