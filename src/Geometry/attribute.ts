class Attribute {
	private _array: Float32Array
	private _itemSize: number

	constructor(data: Float32Array, itemSize: number) {
		this._array = data
		this._itemSize = itemSize
	}

	get array() {
		return this._array
	}

	set array(data: Float32Array) {
		this._array = data
	}

	get itemSize() {
		return this._itemSize
	}

	set itemSize(v: number) {
		this._itemSize = Math.floor(v)
	}

	public dispose() {}
}

export default Attribute
