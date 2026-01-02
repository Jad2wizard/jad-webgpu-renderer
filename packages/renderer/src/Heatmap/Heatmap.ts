import Model from '../Model'
import Geometry from '../geometry/geometry'
import Material from '../material/material'
import { Color, Blending, IPlayable } from '../types'
import {
	renderShaderCode,
	genComputeHeatValueShaderCode,
	computeMaxHeatValueShaderCode,
	sampleRate,
} from '../material/shaders/heatmap'
import Renderer from '../Renderer'
import { Camera } from '../camera/camera'
import Attribute from '../geometry/attribute'
import { deepMerge, genId } from '../utils'
import { HeatPointsPass, MaxHeatValuePass, HeatmapRenderPass } from './HeatmapPasses'
import { Pass } from '../pass/Pass'

// Constants
const HEATMAP_VERTEX_COUNT = 6
const COLOR_ARRAY_SIZE = 5
const EXPANSION_FACTOR = 5
const CLEAR_COLOR: GPUColor = [0, 0, 0, 0]

type ColorList = [Color, Color, Color, Color, Color]
type OffsetList = [number, number, number, number, number]

const defaultStyle = {
	colorList: [
		[1, 0, 0, 0],
		[1, 1, 0, 0],
		[0, 1, 0, 0],
		[0, 0, 1, 0],
		[0, 0, 0, 0],
	] as ColorList,
	colorOffsets: [1, 0.85, 0.55, 0.35, 0] as OffsetList,
	blur: 1,
	radius: 10,
	blending: 'normalBlending' as Blending,
}

type IProps = {
	id: string
	points: Float32Array
	startTime?: Float32Array
	total?: number
	style?: {
		colorList?: ColorList
		colorOffsets?: OffsetList
		blur?: number
		radius?: number
		blending?: Blending
	}
}

class Heatmap extends Model implements IPlayable {
	private points: Float32Array
	private startTime?: Float32Array
	// heatPointsModel 和 maxHeatValueModel 都是在 preRender 阶段执行的渲染
	private heatPointsModel: Model // 负责将根据热力点的坐标和半径渲染各个像素的热力值到输出纹理的R 通道
	private maxHeatValueModel: Model // 负责根据 heatPointsModel 的输出纹理计算所有像素的最大热力值
	private _total: number
	private _cachedColorOffsets: Float32Array | null = null
	private lastResolution = { width: 0, height: 0 }
	/**
	 * points 为热力点的二维坐标 e.g [x0, y0, x1, y1,....]
	 * startTime 为热力点的播放时间，可选
	 * total 为预设的热力点数量，可以大于 points.length / 2
	 * style.colorList 为将浮点数的热力值插值为 rgb 颜色时的插值颜色数组
	 * style.colorOffsets 为颜色插值时各个颜色对应的区间取值为1到0，降序
	 * style.radius 为热力点的像素半径
	 * style.blur (0, 1]，maxHeatValue 对像素热力值做归一化时需先乘以该值
	 * @param props
	 */
	constructor(props: IProps) {
		const geometry = new Geometry(props.id + '-geometry')
		geometry.vertexCount = HEATMAP_VERTEX_COUNT
		const { points, startTime } = props
		const style = deepMerge(defaultStyle, props.style || {})

		const mat = new Material({
			id: props.id + '-material',
			renderCode: renderShaderCode,
			vertexShaderEntry: 'vs',
			fragmentShaderEntry: 'fs',
			blending: props.style?.blending,
		})

		super(props.id, geometry, mat)

		this.validateProps(props)

		this._style = style
		this._total = props.total || points.length / 2
		this._cachedColorOffsets = null

		this.material.updateUniform('maxHeatValueRatio', this.style.blur)
		this.material.updateUniform('colors', this.colorOffsets)

		this.points = points
		this.startTime = startTime

		this.initHeatPointsModel()
		this.initMaxHeatValueModel()
	}

	get style() {
		return this._style as typeof defaultStyle
	}

	get total() {
		return this._total
	}

	get playable() {
		return !!this.startTime
	}

	/**
	 * Validates constructor props
	 */
	private validateProps(props: IProps): void {
		if (!props.points || props.points.length === 0) {
			throw new Error('Points array cannot be empty')
		}
		if (props.points.length % 2 !== 0) {
			throw new Error('Points array length must be even (x,y pairs)')
		}
		if (props.startTime && props.startTime.length !== props.points.length / 2) {
			throw new Error('StartTime array length must match number of points')
		}
		if (props.total && props.total < props.points.length / 2) {
			throw new Error('Total cannot be less than current points count')
		}
	}

	/**
	 * heatValTex 作为 heatPointsModel 的输出纹理以及 maxHeatValueModel 的输入纹理在 R 通道记录了像素热力值
	 * size 为像素的宽高
	 * @param renderer
	 */
	private createHeatValueTexture(renderer: Renderer) {
		const { width, height } = renderer
		const textureFactory = renderer.webgpuBackend.getTextureFactory()

		const heatValueTexture = textureFactory.createTexture({
			size: [width, height, 1],
			format: 'rgba16float', // 因为需要使用纹理的 R 通道存放像素的热力值，故需要选择高精度的浮点数格式，而 rgba32float 又不支持multisample。
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		})
		this.updateTexture('heatValTex', heatValueTexture)
	}

	/**
	 * maxValTex 作为 maxHeatValueModel 输出纹理，记录了所有像素的最大热力值
	 * size 为1x1
	 * @param renderer
	 */
	private createMaxHeatValueTexture(renderer: Renderer) {
		const textureFactory = renderer.webgpuBackend.getTextureFactory()

		const maxHeatValueTexture = textureFactory.createTexture({
			size: [1, 1, 1],
			format: 'rgba16float',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		})
		this.updateTexture('maxValTex', maxHeatValueTexture)
	}

	private initHeatPointsModel() {
		const geo = new Geometry(this.id + '-heat-points-geometry')
		const positionAttribute = new Attribute('position', this.points, 2, {
			stepMode: 'instance',
			shaderLocation: 0,
			capacity: this.total * 2,
		})
		geo.setAttribute('position', positionAttribute)

		if (this.startTime) {
			const startTimeAttribute = new Attribute('startTime', this.startTime, 1, {
				stepMode: 'instance',
				shaderLocation: 1,
				capacity: this.total,
			})
			geo.setAttribute('startTime', startTimeAttribute)
		}

		geo.vertexCount = HEATMAP_VERTEX_COUNT
		geo.instanceCount = this.points.length / 2

		const mat = new Material({
			id: this.id + '-heat-points-material',
			renderCode: genComputeHeatValueShaderCode(!!this.startTime),
			vertexShaderEntry: 'vs',
			fragmentShaderEntry: 'fs',
			blending: 'additiveBlending', //混合阶段使同一像素上的不同热力点的热力值相加后输出到颜色纹理的 R 通道
			presentationFormat: 'rgba16float',
			multisampleCount: 1,
			uniforms: {
				radius: this._style.radius,
			},
		})
		this.heatPointsModel = new Model(this.id + '-heat-points-model', geo, mat)
	}

	private initMaxHeatValueModel() {
		const geo = new Geometry(this.id + '-max-heat-value-geometry')
		geo.vertexCount = 0 // Will be updated when resolution is known
		const mat = new Material({
			id: this.id + '-max-heat-value-material',
			renderCode: computeMaxHeatValueShaderCode,
			vertexShaderEntry: 'vs',
			fragmentShaderEntry: 'fs',
			blending: 'max', //由于输出纹理size 为1x1，所以vertexCount次执行片元着色器之后会将热力值写入同一个位置，在混合阶段通过最大值比较后可以获取最终的最大热力值
			presentationFormat: 'rgba16float',
			multisampleCount: 1,
			primitive: { topology: 'point-list' },
		})
		this.maxHeatValueModel = new Model(this.id + '-max-heat-value-model', geo, mat)
	}

	/**
	 * Checks if resolution has changed
	 */
	private hasResolutionChanged(width: number, height: number): boolean {
		return width !== this.lastResolution.width || height !== this.lastResolution.height
	}

	private checkCreateHeatValueTexture(renderer: Renderer) {
		const { width, height } = renderer
		const resolutionChanged = this.hasResolutionChanged(width, height)

		if (!this.textures['heatValTex'] || resolutionChanged) {
			this.createHeatValueTexture(renderer)
		}

		if (resolutionChanged) {
			this.maxHeatValueModel.geometry.vertexCount = (width * height) / sampleRate / sampleRate
		}

		this.lastResolution = { width, height }
	}

	private reallocate() {
		for (let attr of this.heatPointsModel.geometry.getAttributes()) {
			attr.reallocate(this.total * attr.itemSize)
		}
	}

	get colorOffsets() {
		if (!this._cachedColorOffsets) {
			this._cachedColorOffsets = new Float32Array(4 * COLOR_ARRAY_SIZE)
			for (let i = 0; i < COLOR_ARRAY_SIZE; ++i) {
				this._cachedColorOffsets[i * 4 + 0] = this.style.colorList[i][0]
				this._cachedColorOffsets[i * 4 + 1] = this.style.colorList[i][1]
				this._cachedColorOffsets[i * 4 + 2] = this.style.colorList[i][2]
				this._cachedColorOffsets[i * 4 + 3] = this.style.colorOffsets[i]
			}
		}
		return this._cachedColorOffsets
	}

	/**
	 * Invalidates cached color offsets
	 */
	private invalidateColorCache(): void {
		this._cachedColorOffsets = null
	}

	public setTotal(t: number) {
		this._total = t
		this.reallocate()
	}

	public getPasses(renderer: Renderer, camera: Camera, loadOp: GPULoadOp = 'load'): Pass[] {
		this.checkCreateHeatValueTexture(renderer)
		if (!this.textures['maxValTex']) this.createMaxHeatValueTexture(renderer)

		const heatValTex = this.textures['heatValTex'] as GPUTexture
		const maxValTex = this.textures['maxValTex'] as GPUTexture

		if (!heatValTex || !maxValTex) {
			throw new Error('Heatmap textures not initialized')
		}

		const passes: Pass[] = []

		// Add passes
		const heatPass = new HeatPointsPass(this.heatPointsModel, camera, heatValTex)
		passes.push(heatPass)

		const maxPass = new MaxHeatValuePass(this.maxHeatValueModel, camera, heatValTex, maxValTex)
		passes.push(maxPass)

		// Add final render pass
		const renderPass = new HeatmapRenderPass(
			this,
			camera,
			'output',
			loadOp,
			loadOp === 'clear' ? renderer.clearColor : undefined
		)
		passes.push(renderPass)

		return passes
	}

	public updateCurrentTime(time: number): void {
		this.heatPointsModel.material.updateUniform('currentTime', time)
	}

	public setStyle(style: Exclude<IProps['style'], undefined>) {
		this._style = deepMerge(this.style, style)
		if ('radius' in style) {
			this.heatPointsModel.material.updateUniform('radius', style['radius'])
		}
		if ('blur' in style) {
			this.material.updateUniform('maxHeatValueRatio', style['blur'])
		}
		if ('blending' in style) {
			this.material.changeBlending(style['blending'])
		}
		if ('colorList' in style || 'colorOffsets' in style) {
			this.invalidateColorCache()
			this.material.updateUniform('colors', this.colorOffsets)
		}
	}

	/**
	 * 往当前热力图中追加热力点数据
	 * @param points 热力点的二维坐标数组
	 * @param startTime
	 */
	public appendHeatPoints(points: Float32Array, startTime?: Float32Array) {
		if (!points || points.length === 0) {
			throw new Error('Points array cannot be empty')
		}
		if (points.length % 2 !== 0) {
			throw new Error('Points array length must be even (x,y pairs)')
		}
		const appendLen = points.length / 2
		if (startTime && startTime.length !== appendLen) {
			throw new Error('StartTime array length must match number of points')
		}
		const currentLen = this.heatPointsModel.geometry.instanceCount
		if (appendLen + currentLen > this.total) {
			this._total = currentLen + appendLen * EXPANSION_FACTOR
			this.reallocate()
		}
		const positionAttr = this.heatPointsModel.geometry.getAttribute('position')
		if (positionAttr?.array) {
			positionAttr.array.set(points, currentLen * 2)
			positionAttr.needsUpdate = true
		}
		const startTimeAttr = this.heatPointsModel.geometry.getAttribute('startTime')
		if (startTime && startTimeAttr?.array) {
			startTimeAttr.array.set(startTime, currentLen)
			startTimeAttr.needsUpdate = true
		}

		this.heatPointsModel.geometry.instanceCount += appendLen
	}

	public dispose() {
		super.dispose()

		// Dispose models
		this.maxHeatValueModel.dispose()
		this.heatPointsModel.dispose()

		// Clear cached data
		this._cachedColorOffsets = null

		// Reset resolution tracking
		this.lastResolution = { width: 0, height: 0 }
	}
}

export default Heatmap
