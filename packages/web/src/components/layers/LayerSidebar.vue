<template>
  <div class="w-64 bg-white border-r flex flex-col h-full overflow-y-auto">
    <!-- 图层列表 -->
    <div class="p-3 border-b">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-gray-600">图层</span>
      </div>
      <div v-if="mapStore.layers.length === 0" class="text-xs text-gray-400 py-4 text-center">
        暂无图层，请上传数据
      </div>
      <div v-else class="space-y-1">
        <div
          v-for="layer in mapStore.layers"
          :key="layer.id"
          :class="[
            'flex items-center gap-2 p-2 rounded cursor-pointer text-sm transition-colors',
            mapStore.selectedLayerId === layer.id
              ? 'bg-blue-50 text-blue-700'
              : 'hover:bg-gray-50',
          ]"
          @click="mapStore.selectLayer(layer.id)"
        >
          <span class="text-xs">{{ typeIcon(layer.type) }}</span>
          <el-switch
            :model-value="layer.visible"
            size="small"
            @change="toggleLayer(layer)"
            @click.stop
          />
          <span class="flex-1 truncate">{{ layer.name }}</span>
          <el-popconfirm
            title="确认删除？"
            @confirm="handleDeleteLayer(layer.id)"
            @click.stop
          >
            <template #reference>
              <el-button text size="small" type="danger">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>

    <!-- 上传 GeoJSON -->
    <div class="p-3 border-b">
      <span class="text-sm font-semibold text-gray-600 block mb-2">上传数据</span>
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".geojson,.json"
        :on-change="handleUpload"
        drag
      >
        <el-icon class="text-2xl"><UploadFilled /></el-icon>
        <div class="text-xs mt-1">拖拽或点击上传 GeoJSON</div>
      </el-upload>
    </div>

    <!-- 样式编辑器 -->
    <div v-if="mapStore.selectedLayer" class="p-3 flex-1">
      <span class="text-sm font-semibold text-gray-600 block mb-2">
        样式编辑 — {{ mapStore.selectedLayer.name }}
      </span>
      <StyleEditor
        :layer="mapStore.selectedLayer"
        @update="handleStyleUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Delete, UploadFilled } from "@element-plus/icons-vue"
import { ElMessage } from "element-plus"
import { useMapStore } from "@/stores/map"
import { uploadDataset, createLayer, deleteLayer, updateLayer } from "@/utils/api"
import StyleEditor from "./StyleEditor.vue"
import type { LayerConfig, ScatterLayerConfig, PathLayerConfig, HeatmapLayerConfig } from "@shared/types"

const mapStore = useMapStore()

function typeIcon(type: string) {
  return type === "scatter" ? "●" : type === "path" ? "〰" : "◉"
}

async function toggleLayer(layer: LayerConfig) {
  await updateLayer(mapStore.config!.layers.find(l => l.id === layer.id) ? "" : "", layer.id, {
    visible: !layer.visible,
  })
  layer.visible = !layer.visible
  mapStore.gmapInstance?.layerManager.getLayer(layer.id)?.setVisible(layer.visible)
}

async function handleDeleteLayer(layerId: string) {
  // 从 store 找到 projectId
  const projectId = new URLSearchParams(window.location.pathname).get("")
  // 使用当前 URL 推导
  const pathParts = window.location.pathname.split("/")
  const pid = pathParts[pathParts.length - 1]

  await deleteLayer(pid, layerId)
  mapStore.config!.layers = mapStore.config!.layers.filter(l => l.id !== layerId)
  if (mapStore.selectedLayerId === layerId) mapStore.selectLayer(null)
  ElMessage.success("图层已删除")
}

async function handleUpload(file: any) {
  const pathParts = window.location.pathname.split("/")
  const pid = pathParts[pathParts.length - 1]

  mapStore.isUploading = true
  try {
    const result = await uploadDataset(pid, file.raw, file.name)

    // 自动推断图层类型
    let layerType: "scatter" | "path" | "heatmap" = "scatter"
    if (result.dataset.geometryType?.includes("LineString")) {
      layerType = "path"
    }

    // 自动创建图层
    const layerData = await createLayer(pid, {
      name: result.dataset.name,
      type: layerType,
      datasetId: result.dataset.id,
      fields: {
        lonField: 0,
        latField: 1,
        ...(layerType === "path" ? {} : {}),
      },
    })

    // 添加到 store
    mapStore.config?.layers.push(layerData.layer as any)

    // 在地图上渲染
    const g = mapStore.gmapInstance
    if (g) {
      const dataset = await import("@/utils/api").then(m => m.fetchDatasetData(result.dataset.id))
      const mod = await import("@/utils/applyConfig")
      // TODO: 调用 add*Layer 函数动态添加图层
    }

    ElMessage.success(`上传成功：${result.dataset.featureCount} 条数据`)
  } catch (err: any) {
    ElMessage.error(err.data?.error || "上传失败")
  } finally {
    mapStore.isUploading = false
  }
}

function handleStyleUpdate(layerId: string, style: Record<string, unknown>) {
  mapStore.updateLayerStyle(layerId, style)
  const pathParts = window.location.pathname.split("/")
  const pid = pathParts[pathParts.length - 1]
  updateLayer(pid, layerId, { style }).catch(() => {})
}
</script>
