import Attribute from './attribute'

class Geometry {
	private attributeMap: Record<string, Attribute>

	constructor() {
		this.attributeMap = {}
	}

	public setAttribute(attribtueName: string, attribute: Attribute) {
		this.attributeMap[attribtueName] = attribute
	}

	public removeAttribute(attribtueName: string) {
		const attribute = this.attributeMap[attribtueName]
		if (attribute) {
			attribute.dispose()
			delete this.attributeMap[attribtueName]
		}
	}

	public dispose() {
		for (let k in this.attributeMap) {
			this.attributeMap[k].dispose()
		}
		this.attributeMap = {}
	}
}
