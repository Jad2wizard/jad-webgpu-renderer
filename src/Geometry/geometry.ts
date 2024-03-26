import Attribute from './attribute'

class Geometry {
	private attributeList: {name: string; attribute: Attribute; version: number}[]

	constructor() {
		this.attributeList = []
	}

	public setAttribute<T extends ArrayBufferView>(attribtueName: string, attribute: Attribute) {
		this.attributeList.push({name: attribtueName, attribute, version: -1})
	}

	public removeAttribute(attribtueName: string) {
		const index = this.attributeList.findIndex(a => a.name === attribtueName)
		if (index > -1) {
			this.attributeList[index].attribute.dispose()
			this.attributeList.splice(index, 1)
		}
	}

	public dispose() {
		for (let item of this.attributeList) {
			item.attribute.dispose()
		}
		this.attributeList = []
	}

	public getAttributeBufferLayouts() {
		const vertexBufferLayouts: GPUVertexBufferLayout[] = []
		let location = 0
		for (let item of this.attributeList) {
			const {attribute, name} = item
			const {itemSize, array} = attribute
			const bufferLayout: GPUVertexBufferLayout = {
				arrayStride: itemSize * array.BYTES_PER_ELEMENT,
				attributes: [
					{
						shaderLocation: location++,
						offset: 0,
						format: attribute.getFormat()
					}
				]
			}
			vertexBufferLayouts.push(bufferLayout)
		}
	}

	public getVertexBufferList(device: GPUDevice) {
		const bufferList: GPUBuffer[] = []
		for (let item of this.attributeList) {
			const {attribute, name, version} = item
			if (version !== attribute.version || !attribute.buffer) {
				attribute.updateBuffer(device, name)
			}
			bufferList.push(attribute.buffer as GPUBuffer)
		}
		return bufferList
	}

	public getIndexBuffer(device: GPUDevice) {}
}

export default Geometry
