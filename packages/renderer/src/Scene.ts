import { Object3D } from './Object3D'
import Model from './Model'
import { IRenderable } from './types'

class Scene extends Object3D {
	private _modelList: IRenderable[]
	constructor() {
		super()
		this._modelList = []
	}

	get modelList() {
		return this._modelList.sort((m, n) => (m.renderOrder > n.renderOrder ? -1 : 1))
	}

	public getAllModels() {
		return this._modelList.sort((m, n) => (m.renderOrder > n.renderOrder ? -1 : 1))
	}

	public addModel(model: IRenderable) {
		if (!this._modelList.includes(model)) this._modelList.push(model)
	}

	public removeModel(model: IRenderable) {
		const index = this._modelList.indexOf(model)
		if (index > -1) {
			this._modelList.splice(index, 1)
		}
	}

	public getModel(id: string) {
		return this._modelList.find((m) => m.id === id) || null
	}

	public dispose() {
		for (let m of this._modelList) {
			m.dispose()
		}
		this._modelList = []
	}
}

export default Scene
