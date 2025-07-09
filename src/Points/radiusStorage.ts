import Storage from '../material/storage'

type IProps = {
	id: string
	data?: Uint8Array
	total?: number
}

/**
 *  因为 radius 数值类型为 uint8，而 webgpu 不支持 u8类型的 vertex buffer
 *  故将散点的半径attribute 数据存放在 storage 中，并将四个相邻散点的 radius 合并到一个 uint32中
 */
class RadiusStorage extends Storage {
	private _hasRealData: boolean

	constructor(props: IProps) {
		const hasRealData = !!props.data
		const radiusData = hasRealData ? props.data : new Uint8Array(1)
		super({ id: props.id, name: 'radius', value: radiusData })
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
		return this.value[index]
	}

	updatePointsRadius(
		radius: number | number[],
		defaultRadius: number,
		total: number,
		pointIndices: number[]
	) {
		if (!this.hasData) {
			const value = new Uint8Array(total).fill(defaultRadius)
			this.updateValue(value)
		} else {
			const valueUint8 = new Uint8Array(this.value.buffer)
			for (let i of pointIndices) {
				valueUint8[i] = Array.isArray(radius) ? radius[pointIndices.indexOf(i)] : radius
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

	appendData(radiusArray: Uint8Array, appendLen: number, start: number) {
		if (!this.hasData) return
		this.value.set(radiusArray, start)
		this.needsUpdate = true
	}
}

export default RadiusStorage
