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
					<el-switch
						:model-value="layer.visible"
						size="small"
						@change="toggleLayer(layer)"
						@click.stop
					/>
					<span class="flex-1 truncate">{{ layer.name }}</span>
					<el-button
						v-if="layer.type === 'scatter'"
						text
						size="small"
						title="切换为热力图"
						@click.stop="handleConvertToHeatmap(layer.id)"
					>
						◉
					</el-button>
					<el-button
						v-if="layer.type === 'heatmap'"
						text
						size="small"
						title="切换为散点图"
						@click.stop="handleConvertToScatter(layer.id)"
					>
						●
					</el-button>
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
				:property-fields="propertyFields"
				@update="handleStyleUpdate"
				@apply-mapping="handleApplyMapping"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Delete, UploadFilled } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMapStore } from '@/stores/map'
import { uploadDataset, createLayer, deleteLayer, updateLayer, fetchDatasetData } from '@/utils/api'
import { createLayersFromConfig } from '@/utils/applyConfig'
import StyleEditor from './StyleEditor.vue'
import type { LayerConfig } from '@shared/types'

const mapStore = useMapStore()
const route = useRoute()
const projectId = computed(() => route.params.id as string)
const propertyFields = ref<string[] | undefined>(undefined)

// 当选中散点图层时，获取数据集的属性字段名
watch(
	() => mapStore.selectedLayer,
	async (layer) => {
		if (layer?.type === 'scatter') {
			try {
				const ds = await fetchDatasetData(projectId.value, layer.datasetId)
				propertyFields.value = ds.propertyFields
			} catch {
				propertyFields.value = undefined
			}
		} else {
			propertyFields.value = undefined
		}
	},
	{ immediate: true }
)

async function toggleLayer(layer: LayerConfig) {
	await updateLayer(projectId.value, layer.id, {
		visible: !layer.visible,
	})
	layer.visible = !layer.visible
	mapStore.gmapInstance?.layerManager.getLayer(layer.id)?.setVisible(layer.visible)
}

async function handleDeleteLayer(layerId: string) {
	await deleteLayer(projectId.value, layerId)
	mapStore.config!.layers = mapStore.config!.layers.filter((l) => l.id !== layerId)
	if (mapStore.selectedLayerId === layerId) mapStore.selectLayer(null)
	ElMessage.success('图层已删除')
}

async function handleUpload(file: any) {
	mapStore.isUploading = true
	try {
		const result = await uploadDataset(projectId.value, file.raw, file.name)

		let layerType: 'scatter' | 'path' | 'heatmap' = 'scatter'
		if (result.dataset.geometryType?.includes('LineString')) {
			layerType = 'path'
		}

		const layerData = await createLayer(projectId.value, {
			name: result.dataset.name,
			type: layerType,
			datasetId: result.dataset.id,
			fields: {
				lonField: 0,
				latField: 1,
			},
		})

		mapStore.config?.layers.push(layerData.layer as any)

		if (mapStore.gmapInstance) {
			const dataset = await fetchDatasetData(projectId.value, result.dataset.id)
			const config = mapStore.config!
			await createLayersFromConfig(mapStore.gmapInstance, config, async (dsId) => {
				if (dsId === result.dataset.id) return dataset.data
				return (await fetchDatasetData(projectId.value, dsId)).data
			})
		}

		ElMessage.success(`上传成功：${result.dataset.featureCount} 条数据`)
	} catch (err: any) {
		ElMessage.error(err.data?.error || '上传失败')
	} finally {
		mapStore.isUploading = false
	}
}

function handleStyleUpdate(layerId: string, style: Record<string, unknown>) {
	mapStore.updateLayerStyle(layerId, style)
	updateLayer(projectId.value, layerId, { style }).catch(() => {})
}

async function handleApplyMapping(layerId: string) {
	try {
		await mapStore.rebuildScatterLayerFromMapping(projectId.value, layerId)
		ElMessage.success('映射已应用')
	} catch (err: any) {
		ElMessage.error('应用映射失败')
	}
}

async function handleConvertToHeatmap(layerId: string) {
	try {
		await updateLayer(projectId.value, layerId, { type: 'heatmap' })
		await mapStore.convertLayerToHeatmap(projectId.value, layerId)
		ElMessage.success('已转为热力图')
	} catch (err: any) {
		ElMessage.error('转换失败')
	}
}

async function handleConvertToScatter(layerId: string) {
	try {
		await updateLayer(projectId.value, layerId, { type: 'scatter' })
		await mapStore.convertLayerToScatter(projectId.value, layerId)
		ElMessage.success('已转为散点图')
	} catch (err: any) {
		ElMessage.error('转换失败')
	}
}
</script>
