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

		<!-- 散点：数据驱动的颜色/半径映射 -->
		<div v-if="layer.type === 'scatter'" class="border-t pt-3 mt-2">
			<label class="text-xs font-semibold text-gray-500 block mb-2">数据映射（可选）</label>

			<!-- 颜色映射 -->
			<div class="mb-2">
				<label class="text-xs text-gray-400 block mb-1"
					>颜色通道
					<span class="text-gray-300">— 选择数据列作为 R/G/B/A</span>
				</label>
				<div class="grid grid-cols-4 gap-1">
					<div v-for="ch in colorChannels" :key="ch">
						<span class="text-xs text-gray-400">{{ ch }}</span>
						<el-select
							:model-value="(layer.style as any).colorMapping?.[ch.toLowerCase()]"
							@update:model-value="(v: number | undefined) => emitColorMapping(ch, v)"
							size="small"
							clearable
							class="w-full"
						>
							<el-option
								v-for="col in columnOptions"
								:key="col.value"
								:label="col.label"
								:value="col.value"
							/>
						</el-select>
					</div>
				</div>
			</div>

			<!-- 半径映射 -->
			<div class="mb-2">
				<label class="text-xs text-gray-400 block mb-1"
					>半径
					<span class="text-gray-300">— 选择数据列作为半径值</span>
				</label>
				<el-select
					:model-value="(layer.style as any).radiusMapping?.field"
					@update:model-value="
						(v: number | undefined) =>
							emit('update', layer.id, {
								radiusMapping: v != null ? { ...(layer.style as any).radiusMapping, field: v } : undefined,
							})
					"
					size="small"
					clearable
					class="w-full"
				>
					<el-option
						v-for="col in columnOptions"
						:key="col.value"
						:label="col.label"
						:value="col.value"
					/>
				</el-select>
			</div>

			<!-- 应用映射 -->
			<el-button
				type="primary"
				size="small"
				plain
				@click="emit('applyMapping', layer.id)"
			>
				应用映射
			</el-button>
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
import { computed } from 'vue'
import type { LayerConfig, Color } from '@shared/types'

const props = defineProps<{
	layer: LayerConfig
	propertyFields?: string[]
}>()

const emit = defineEmits<{
	update: [layerId: string, style: Record<string, unknown>]
	applyMapping: [layerId: string]
}>()

const colorChannels = ['R', 'G', 'B', 'A'] as const

// 构建列选择选项：lon(0), lat(1), 属性列(2+)
const columnOptions = computed(() => {
	const options: { label: string; value: number }[] = [
		{ label: '经度 (0)', value: 0 },
		{ label: '纬度 (1)', value: 1 },
	]
	const fields = props.propertyFields
	if (fields && fields.length > 0) {
		for (let i = 0; i < fields.length; i++) {
			options.push({ label: `${fields[i]} (${i + 2})`, value: i + 2 })
		}
	} else {
		// fallback：没有属性名时显示列索引
		for (let i = 2; i < 10; i++) {
			options.push({ label: `列 ${i}`, value: i })
		}
	}
	return options
})

function emitColorMapping(channel: 'R' | 'G' | 'B' | 'A', value: number | undefined) {
	const key = channel.toLowerCase()
	const layerStyle = (props.layer.style as any)
	const existing = layerStyle.colorMapping || {}
	const newMapping = { ...existing, [key]: value }

	// 如果四个通道都清空，删除整个 colorMapping
	const hasAny = newMapping.r != null || newMapping.g != null || newMapping.b != null || newMapping.a != null
	emit('update', props.layer.id, {
		colorMapping: hasAny ? newMapping : undefined,
	})
}

function rgbaToHex(color: Color | undefined): string {
	if (!color) return '#ff0000'
	const [r, g, b] = color
	const toHex = (v: number): string => {
		if (v == null || !isFinite(v)) return '00'
		return Math.round(Math.max(0, Math.min(1, v)) * 255)
			.toString(16)
			.padStart(2, '0')
	}
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function emitColor(value: string) {
	let r: number, g: number, b: number, a: number

	// el-color-picker 可能传出 hex（如 #ff0000）或 rgb（如 rgb(255,0,0)）格式
	const rgbMatch = value.match(
		/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
	)
	if (rgbMatch) {
		r = parseInt(rgbMatch[1]) / 255
		g = parseInt(rgbMatch[2]) / 255
		b = parseInt(rgbMatch[3]) / 255
		a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1
	} else {
		const hex = value.replace('#', '')
		r = parseInt(hex.slice(0, 2), 16) / 255
		g = parseInt(hex.slice(2, 4), 16) / 255
		b = parseInt(hex.slice(4, 6), 16) / 255
		a = hex.length > 6 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
	}

	// 二次校验：确保不会把 NaN 传出去
	const color: Color = [
		isFinite(r) ? r : 1,
		isFinite(g) ? g : 0,
		isFinite(b) ? b : 0,
		isFinite(a) ? a : 1,
	]
	emit('update', props.layer.id, { color })
}
</script>
