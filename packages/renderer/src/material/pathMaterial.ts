import Material from './material'
import { Blending, Color } from '../types'
import { genShaderCode } from './shaders/path'
import Storage from './storage'

export type IProps = {
	modelName: string
	color: Color
	lineWidth: number
	unplayedColor?: Color
	unplayedLineWidth?: number
	blending?: Blending
	tailDuration?: number
	positions: Float32Array
	startTimes?: Float32Array
	drawLine?: boolean
}

class PathMaterial extends Material {
	public hasTime = false
	public hasTail = false
	
	constructor(props: IProps) {
		const { color, lineWidth, modelName, positions, startTimes, drawLine } = props
		const hasTime = !!startTimes
		const hasTail = hasTime && !!props.tailDuration && props.tailDuration > 0
		
		const storages: Record<string, Storage> = {
			positions: new Storage({
				id: modelName + '-positions-storage',
				name: 'positions',
				value: positions
			})
		}
		
		if (startTimes) {
			storages.startTimes = new Storage({
				id: modelName + '-startTimes-storage',
				name: 'startTimes',
				value: startTimes
			})
		}
		
		const uniforms: Record<string, any> = {
			style: {
				color,
				lineWidth: drawLine ? 1 : lineWidth,
				...(hasTime && props.unplayedColor ? { unplayedColor: props.unplayedColor } : {})
			}
		}
		
		if (hasTime) {
			uniforms.time = 0
		}
		
		if (hasTail) {
			uniforms.tailDuration = props.tailDuration
		}
		
		super({
			id: modelName + '-material',
			renderCode: genShaderCode(hasTime, hasTail),
			vertexShaderEntry: drawLine ? 'lineVs' : 'vs',
			fragmentShaderEntry: 'fs',
			blending: props.blending || 'normalBlending',
			storages,
			uniforms,
			primitive: drawLine ? { topology: 'line-strip' } : { topology: 'triangle-list' }
		})
		
		this.hasTime = hasTime
		this.hasTail = hasTail
	}
	
	public updateTime(time: number) {
		this.updateUniform('time', time)
	}
	
	public changeStyle(style: Partial<IProps>) {
		const styleUniform = this.getUniform('style')
		if (styleUniform && styleUniform.value) {
			for (const key in style) {
				if (key === 'color' || key === 'lineWidth' || key === 'unplayedColor') {
					styleUniform.value[key] = style[key as keyof typeof style]
				}
			}
			styleUniform.needsUpdate = true
		}
		
		if (style.tailDuration !== undefined) {
			this.updateUniform('tailDuration', style.tailDuration)
		}
	}
}

export default PathMaterial