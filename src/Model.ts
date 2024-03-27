import {Object3D} from './Object3D'
import Geometry from './geometry/geometry'
import Material from './material/material'

type Options = {
	id?: string
}

class Model extends Object3D {
	private _geometry: Geometry
	private _material: Material

	constructor(geometry: Geometry, material: Material, opts?: Options) {
		super()
		this._geometry = geometry
		this._material = material
	}

	get geometry() {
		return this._geometry
	}

	set geometry(geo: Geometry) {
		this._geometry = geo
	}

	get material() {
		return this._material
	}

	set material(mat: Material) {
		this._material = mat
	}
}

export default Model
