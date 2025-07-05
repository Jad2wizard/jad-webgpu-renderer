import Model from '../Model'
import { Path, Style } from './Path'
import Geometry from '../geometry/geometry'
import Material from '../material/material'
import { genHeadPointShaderCode } from '../material/shaders/path'

export class HeadPoint extends Model {
	constructor(pathModel: Path, style: Required<Style>) {
		const headPointColor = style.headPointColor || style.color
		const headPointSize = style.headPointSize
		const geometry = new Geometry(pathModel.id + '-headpoint-geometry')
		geometry.vertexCount = 6
		geometry.instanceCount = 1

		debugger
		const storages: Record<string, any> = {}
		const uniforms: Record<string, any> = {
			time: 0,
			size: headPointSize,
			pointIndex: 0,
		}

		uniforms.headPointColor = headPointColor

		// 共享path的storage，现在binding索引已经对齐，可以直接共享
		const pathPositionStorage = pathModel.material.getStorage('positions')
		const pathStartTimeStorage = pathModel.material.getStorage('startTimes')
		if (pathPositionStorage) {
			storages.positions = pathPositionStorage
		}
		if (pathStartTimeStorage) {
			storages.startTimes = pathStartTimeStorage
		}

		const material = new Material({
			id: pathModel.id + '-headpoint-material',
			renderCode: genHeadPointShaderCode(),
			vertexShaderEntry: 'vs',
			fragmentShaderEntry: 'fs',
			blending: style.blending,
			uniforms,
			storages,
		})

		super(pathModel.id, geometry, material)
	}

	dispose() {
		this._geometry.dispose()
		const uniforms = this.material.getUniforms()
		for (let un in uniforms) {
			uniforms[un].dispose()
		}
	}
}
