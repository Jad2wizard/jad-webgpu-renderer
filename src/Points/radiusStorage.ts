import Storage, { IProps as StorageProps } from '../material/storage'
import { packUint8ToUint32, unpackUint32ToUint8 } from '@/utils'

type IProps = {
	id: string
	data?: Uint8Array
	total?: number
}

export const transformRadiusArray = (data: Uint8Array | { value: number; total: number }) => {
	const radiuses = new Uint32Array(Math.ceil('total' in data ? data.total / 4 : data.length / 4))
	for (let i = 0; i < radiuses.length; ++i) {
		if ('value' in data) {
			const v = data.value
			radiuses[i] = packUint8ToUint32([v, v, v, v])
		} else {
			// 修复：data数组中每个元素都是一个radius值，将4个连续的radius值打包成一个uint32
			// 例如：data[0,1,2,3] -> radiuses[0], data[4,5,6,7] -> radiuses[1]
			radiuses[i] = packUint8ToUint32([
				data[i * 4 + 0] || 0,
				data[i * 4 + 1] || 0,
				data[i * 4 + 2] || 0,
				data[i * 4 + 3] || 0,
			])
		}
	}
	return radiuses
}

/**
 *  因为 radius 数值类型为 uint8，而 webgpu 不支持 u8类型的 vertex buffer
 *  故将散点的半径attribute 数据存放在 storage 中，并将四个相邻散点的 radius 合并到一个 uint32中
 */
class RadiusStorage extends Storage {
	private _hasRealData: boolean

	constructor(props: IProps) {
		let radiusUint32Array: Uint32Array | undefined
		const hasRealData = !!props.data
		if (props.data) {
			radiusUint32Array = transformRadiusArray(props.data)
		} else {
			// 当没有数据时，创建一个最小的有效数组以避免 WebGPU 绑定组错误
			radiusUint32Array = new Uint32Array(1)
		}
		super({ id: props.id, name: 'radius', value: radiusUint32Array })
		this._hasRealData = hasRealData
		if (props.total && props.data && props.data.length < props.total) {
			this.reallocate(props.total)
		}
	}

	get hasData() {
		return this._hasRealData
	}

	getPointRadius(index: number) {
		if (!this.hasData) return undefined
		const i = Math.floor(index / 4)
		const offset = index % 4
		return unpackUint32ToUint8(this.value[i])[offset]
	}

	updatePointsRadius(
		radius: number | number[],
		defaultRadius: number,
		total: number,
		pointIndices: number[]
	) {
		if (!this.hasData) {
			const uint32Arr = transformRadiusArray({ value: defaultRadius, total })
			this.updateValue(uint32Arr)
		}
		if (this.value) {
			for (let i of pointIndices) {
				const index = Math.floor(i / 4)
				const offset = i % 4
				const unpacked = unpackUint32ToUint8(this.value[index])
				unpacked[offset] = Array.isArray(radius) ? radius[pointIndices.indexOf(i)] : radius
				this.value[index] = packUint8ToUint32(unpacked)
			}
		}
		this.needsUpdate = true
	}

	reallocate(size: number) {
		if (!this.hasData) return
		const sizeInUin32 = Math.ceil(size / 4)
		//@ts-ignore
		const newValue = new this._value.constructor(sizeInUin32) as typeof this._value
		newValue.set(this._value.subarray(0, sizeInUin32))
		this._value = newValue
		// Buffer 大小调整将在下次 updateBuffer 时处理
		this.needsUpdate = true
	}

	appendData(radiusArray8: Uint8Array, appendLen: number, start: number) {
		if (!this.hasData) return
		const si = Math.floor(start / 4)
		const sj = start % 4
		let offset = 0
		if (sj > 0) {
			const unpacked = unpackUint32ToUint8(this.value[si])
			for (let i = sj; i < unpacked.length; ++i) {
				unpacked[i] = radiusArray8[offset++]
			}
			this.value[si] = packUint8ToUint32(unpacked)
		}
		const toAppend = transformRadiusArray(radiusArray8.subarray(offset))
		this.value.set(toAppend, si + (sj > 0 ? 1 : 0))
		this.needsUpdate = true
	}
}

export default RadiusStorage
