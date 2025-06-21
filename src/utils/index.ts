import { Color } from '@/types'
import * as moment from 'moment'
import { TypedArray } from 'three'
import * as _ from 'lodash'

export const genId = () => {
	return moment().valueOf() + '_' + ((Math.random() * 1000000) | 0)
}

export const minUniformBufferOffsetAlignment = 256

export const minStorageBufferOffsetAlignment = 256

export const indexFormat = 'uint32'

export const binarySearch = (
	arr: TypedArray | Array<number | string>,
	target: number | string,
	compare: 'less' | 'more' = 'less'
) => {
	function traverse(si: number, ei: number): number {
		if ((arr[si] > target && compare === 'less') || (arr[ei] < target && compare === 'more')) return -1
		if (si + 1 === ei) {
			if (arr[si] <= target && compare === 'less') return si
			if (arr[ei] >= target && compare === 'more') return ei
		}
		const mid = si + Math.ceil((ei - si) / 2)
		return arr[mid] > target ? traverse(si, mid) : traverse(mid, ei)
	}
	return traverse(0, arr.length - 1)
}

export const convertUniformColor = <T extends Color | undefined>(c: T): T => {
	if (c === undefined) return undefined as T
	const res: number[] = []
	if (c.some((i) => i > 1)) {
		for (let i = 0; i < 3; ++i) res.push(c[i] / 255)
		res.push(c[3])
	} else res.push(...c)
	return res as T
}

export const deepMerge = <T>(...obj: Partial<T>[]): T => {
	return _.merge({}, ...obj)
}

/**
 * 将四个 uint8 数值打包成一个 uint32 数值
 * 使用小端字节序，即 [a, b, c, d] => (d << 24) | (c << 16) | (b << 8) | a
 *  如果 data 为 color 存放[r, g, b, a] 四个通道的分量，那么通道 r 的值位于 uint32的最低四个字节中
 * @example packUint8ToUint32([255, 0, 0, 0]) => 4278190080
 * @param {number[]} data 一个长度为四的 uint8 数组
 * @returns {number} 一个 uint32数值
 */
export const packUint8ToUint32 = (data: [number, number, number, number]) => {
	let res = 0
	for (let i = 0; i < data.length; ++i) {
		res += (data[i] & 255) << (i * 8)
	}
	return res
}

/**
 * 将一个 uint32 数值分解成四个 uint8 数值
 * 使用小端字节序，即 num => [(num >> 0) & 255, (num >> 8) & 255, (num >> 16) & 255, (num >> 24) & 255]
 * @example unpackUint32ToUint8(4278190080) => [255, 0, 0, 0]
 * @param {number} num 一个 uint32数值
 * @returns {[number, number, number, number]} 一个长度为四的 uint8 数组
 */
export const unpackUint32ToUint8 = (num: number) => {
	let res: [number, number, number, number] = [0, 0, 0, 0]
	for (let i = 0; i < 4; ++i) {
		res[i] = (num >> (i * 8)) & 255
	}
	return res
}

/**
 * 将 16 位半精度浮动数（IEEE 754 half-precision float）转换为 32 位单精度浮动数（float32）
 *
 * 16 位半精度浮动数采用以下结构：
 * - 1 位符号位
 * - 5 位指数部分（exponent）
 * - 10 位尾数部分（mantissa）
 *
 * @param {number} half - 一个 16 位整数，表示一个半精度浮动数。此数应符合 IEEE 754 半精度浮动数格式。
 * @returns {number} 返回转换后的 32 位单精度浮动数（float32）。
 */
export function halfToFloat(half: number): number {
	// 提取符号位（sign bit）：取最高位，0 表示正数，1 表示负数
	const sign = (half >> 15) & 0x1

	// 提取指数部分（exponent）：取接下来的 5 位
	const exponent = (half >> 10) & 0x1f

	// 提取尾数部分（mantissa）：取最低的 10 位
	const mantissa = half & 0x3ff

	// 处理指数为 0 的情况（表示零或非规格化数）
	if (exponent === 0) {
		// 如果尾数部分也为 0，则表示零（0 或 -0）
		if (mantissa === 0) {
			return sign === 0 ? 0 : -0
		} else {
			// 如果尾数部分不为 0，表示一个非规格化数（denormalized number）
			// 这种情况的指数为 -14
			return ((sign === 0 ? 1 : -1) * Math.pow(2, -14) * mantissa) / Math.pow(2, 10)
		}
	} else if (exponent === 0x1f) {
		// 如果指数部分是 11111（0x1f），表示无穷大（Infinity）或 NaN（Not a Number）
		// - 如果尾数部分为 0，表示无穷大
		// - 如果尾数部分不为 0，表示 NaN
		if (mantissa === 0) {
			return sign === 0 ? Infinity : -Infinity
		} else {
			return NaN
		}
	} else {
		// 根据 IEEE 754 标准的计算方式，转换为浮动数
		// 使用公式：(-1)^sign * 2^(exponent - 15) * (1 + mantissa / 1024)
		return (sign === 0 ? 1 : -1) * Math.pow(2, exponent - 15) * (1 + mantissa / Math.pow(2, 10))
	}
}

/**
 * 将 Uint16Array 中的每个 16 位半精度浮动数转换为 32 位单精度浮动数（float32）
 *
 * @param {Uint16Array} data - 一个包含多个 16 位半精度浮动数的数组（Uint16Array）。
 * @returns {Float32Array} 返回一个包含转换后的 32 位单精度浮动数的数组（Float32Array）。
 */
export function convertHalfToFloatArray(data: Uint16Array): Float32Array {
	const result = new Float32Array(data.length)

	for (let i = 0; i < data.length; i++) {
		result[i] = halfToFloat(data[i])
	}

	return result
}

console.log(packUint8ToUint32([1, 0, 0, 1]))

/**
 * 将前端常见的颜色格式转换为标准化的 RGBA 颜色值
 * 每个分量的取值范围为 0 到 1
 *
 * @param color - 支持的颜色格式：
 *   - 十六进制字符串: "#ff0000", "#f00", "ff0000", "f00"
 *   - RGB/RGBA 字符串: "rgb(255, 0, 0)", "rgba(255, 0, 0, 1)"
 *   - 数组格式: [255, 0, 0], [255, 0, 0, 255], [1, 0, 0, 1]
 * @returns 标准化的 RGBA 颜色值 [r, g, b, a]，每个分量范围为 0-1
 */
export function normalizeColor(color: string | number[]): Color {
	// 处理字符串格式
	if (typeof color === 'string') {
		const trimmed = color.trim().toLowerCase()

		// 处理十六进制格式
		if (trimmed.startsWith('#') || /^[0-9a-f]{3,8}$/i.test(trimmed)) {
			let hex = trimmed.replace('#', '')

			// 处理简写格式 (如 "f00" -> "ff0000")
			if (hex.length === 3) {
				hex = hex
					.split('')
					.map((char) => char + char)
					.join('')
			}

			// 处理 4 位简写格式 (如 "f00a" -> "ff0000aa")
			if (hex.length === 4) {
				hex = hex
					.split('')
					.map((char) => char + char)
					.join('')
			}

			const r = parseInt(hex.substring(0, 2), 16) / 255
			const g = parseInt(hex.substring(2, 2), 16) / 255
			const b = parseInt(hex.substring(4, 2), 16) / 255
			const a = hex.length >= 8 ? parseInt(hex.substring(6, 2), 16) / 255 : 1

			return [r, g, b, a]
		}

		// 处理 rgb/rgba 格式
		const rgbMatch = trimmed.match(/rgba?\(\s*([^\)]+)\)/)
		if (rgbMatch) {
			const values = rgbMatch[1].split(',').map((v) => parseFloat(v.trim()))
			const r = values[0] / 255
			const g = values[1] / 255
			const b = values[2] / 255
			const a = values.length > 3 ? values[3] : 1
			return [r, g, b, a]
		}

		throw new Error(`Unsupported color format: ${color}`)
	}

	// 处理数组格式
	if (Array.isArray(color)) {
		if (color.length < 3 || color.length > 4) {
			throw new Error('Color array must have 3 or 4 elements')
		}

		let [r, g, b, a = 1] = color

		// 检测是否为 0-255 范围的值
		if (r > 1 || g > 1 || b > 1) {
			r /= 255
			g /= 255
			b /= 255
			if (a > 1) a /= 255
		}

		return [r, g, b, a]
	}

	throw new Error(`Unsupported color type: ${typeof color}`)
}
