import {Object3D} from './Object3D'
import Model from './Model'

class Scene extends Object3D {
	private _modelList: Model[]
	constructor() {
		super()
		this._modelList = []
	}

	get modelList() {
		return this._modelList
	}
}

export default Scene
