import Storage, { IProps as StorageProps } from '../material/storage'
import { packUint8ToUint32, unpackUint32ToUint8 } from '@/utils'

type IProps = {
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
	constructor(props: IProps) {
		const radiusUint32Array = props.data ? transformRadiusArray(props.data) : undefined
		console.log(radiusUint32Array)
		super({ name: 'radius', value: radiusUint32Array })
		if (props.total && props.data && props.data.length < props.total) {
			this.reallocate(props.total)
		}
	}

	get hasData() {
		return !!this._value
	}

	getPointRadius(index: number) {
		if (!this.value) return undefined
		const i = Math.floor(index / 4)
		const offset = index % 4
		return unpackUint32ToUint8(this.value[i])[offset]
	}

	updatePointsRadius(radius: number | number[], defaultRadius: number, total: number, pointIndices: number[]) {
		if (!this.value) {
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
		if (!this._value) return
		const sizeInUin32 = Math.ceil(size / 4)
		//@ts-ignore
		const newValue = new this._value.constructor(sizeInUin32) as typeof this._array
		newValue.set(this._value.subarray(0, sizeInUin32))
		this._value = newValue
		this._bufferView.size = newValue.byteLength
		this.needsUpdate = true
	}

	appendData(radiusArray8: Uint8Array, appendLen: number, start: number) {
		if (!this.value) return
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
