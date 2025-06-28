import Material from '../material/material'
import { Blending, Color } from '../types'
import { getShaderCode } from '../material/shaders/points'
import RadiusStorage from './radiusStorage'

export type IProps = {
	modelName: string
	hasColorAttribute: boolean
	total: number
	blending: Blending
	color: Color
	radius: number
	radiusStorage: RadiusStorage
	hasTime?: boolean
}

class PointMaterial extends Material {
	public hasColorAttribute = false
	public hasRadiusAttribute = false
	public hasTimeAttribute = false
	constructor(props: IProps) {
		const { color, radius, modelName } = props
		super({
			id: modelName + '-material',
			renderCode: getShaderCode(
				props.hasColorAttribute,
				props.radiusStorage.hasData,
				!!props.hasTime
			),
			vertexShaderEntry: 'vs',
			fragmentShaderEntry: 'fs',
			blending: props.blending,
			storages: { radius: props.radiusStorage },
			uniforms: { style: { color, radius, currentTime: -1 } },
		})

		this.hasColorAttribute = props.hasColorAttribute
		this.hasRadiusAttribute = props.radiusStorage.hasData
		this.hasTimeAttribute = !!props.hasTime
	}

	public updateShaderCode(hasColor: boolean, hasRadius: boolean, hasTime: boolean) {
		this.changeShaderCode(getShaderCode(hasColor, hasRadius, hasTime))
		this.hasColorAttribute = hasColor
		this.hasRadiusAttribute = hasRadius
		this.hasTimeAttribute = hasTime
	}

	public updateUniform(uniformName: string, value: any) {
		const styleUniform = this.getUniform('style')
		if (!styleUniform) return
		if (!(uniformName in styleUniform.value)) return
		styleUniform.updateValue({ ...styleUniform.value, [uniformName]: value })
	}
}

export default PointMaterial
