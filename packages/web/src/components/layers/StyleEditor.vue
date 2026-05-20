<template>
	<div class="space-y-3">
		<!-- 通用：颜色 -->
		<div>
			<label class="text-xs text-gray-500 block mb-1">颜色</label>
			<el-color-picker
				:model-value="rgbaToHex(props.layer.style.color)"
				@change="(c: string) => emitColor(c)"
				size="small"
				show-alpha
			/>
		</div>

		<!-- 散点/热力图：半径 -->
		<div v-if="layer.type === 'scatter' || layer.type === 'heatmap'">
			<label class="text-xs text-gray-500 block mb-1">
				半径 <span class="text-gray-300">{{ (layer.style as any).radius }}</span>
			</label>
			<el-slider
				:model-value="(layer.style as any).radius"
				:min="1"
				:max="layer.type === 'heatmap' ? 100 : 50"
				@update:model-value="(v: number) => emit('update', layer.id, { radius: v })"
			/>
		</div>

		<!-- 轨迹：线宽 -->
		<div v-if="layer.type === 'path'">
			<label class="text-xs text-gray-500 block mb-1">
				线宽 <span class="text-gray-300">{{ (layer.style as any).lineWidth }}</span>
			</label>
			<el-slider
				:model-value="(layer.style as any).lineWidth"
				:min="1"
				:max="20"
				@update:model-value="(v: number) => emit('update', layer.id, { lineWidth: v })"
			/>
		</div>

		<!-- 混合模式 -->
		<div>
			<label class="text-xs text-gray-500 block mb-1">混合模式</label>
			<el-select
				:model-value="layer.style.blending"
				@update:model-value="(v: string) => emit('update', layer.id, { blending: v })"
				size="small"
				class="w-full"
			>
				<el-option label="正常" value="normalBlending" />
				<el-option label="叠加增亮" value="additiveBlending" />
				<el-option label="相减变暗" value="subtractiveBlending" />
			</el-select>
		</div>

		<!-- 散点：高亮 -->
		<div v-if="layer.type === 'scatter'">
			<label class="text-xs text-gray-500 block mb-1">高亮半径</label>
			<el-slider
				:model-value="(layer.style as any).highlight?.radius || 15"
				:min="5"
				:max="50"
				@update:model-value="
					(v: number) =>
						emit('update', layer.id, {
							highlight: { ...(layer.style as any).highlight, radius: v },
						})
				"
			/>
		</div>

		<!-- 热力图：模糊 -->
		<div v-if="layer.type === 'heatmap'">
			<label class="text-xs text-gray-500 block mb-1">
				模糊 <span class="text-gray-300">{{ (layer.style as any).blur }}</span>
			</label>
			<el-slider
				:model-value="(layer.style as any).blur"
				:min="0"
				:max="1"
				:step="0.05"
				@update:model-value="(v: number) => emit('update', layer.id, { blur: v })"
			/>
		</div>

		<!-- 轨迹：头部指示点 -->
		<div v-if="layer.type === 'path'" class="flex items-center gap-2">
			<label class="text-xs text-gray-500">显示头部指示点</label>
			<el-switch
				:model-value="(layer.style as any).headPointVisible"
				size="small"
				@change="(v: boolean) => emit('update', layer.id, { headPointVisible: v })"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { LayerConfig, Color } from '@shared/types'

const props = defineProps<{
	layer: LayerConfig
}>()

const emit = defineEmits<{
	update: [layerId: string, style: Record<string, unknown>]
}>()

function rgbaToHex(color: Color | undefined): string {
	if (!color) return '#ff0000'
	const [r, g, b] = color
	const toHex = (v: number) =>
		Math.round(v * 255)
			.toString(16)
			.padStart(2, '0')
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function emitColor(hex: string) {
	const r = parseInt(hex.slice(1, 3), 16) / 255
	const g = parseInt(hex.slice(3, 5), 16) / 255
	const b = parseInt(hex.slice(5, 7), 16) / 255
	const a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1
	emit('update', props.layer.id, { color: [r, g, b, a] })
}
</script>
