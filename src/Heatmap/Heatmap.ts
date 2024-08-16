import Model from '../Model'
import Geometry from '../geometry/geometry'
import Material from '../material/material'
import { Color, Blending, IPlayable } from '../types'
import {
	renderShaderCode,
	genComputeHeatValueShaderCode,
	computeMaxHeatValueShaderCode,
	sampleRate
} from '../material/shaders/heatmap'
import Renderer from '../Renderer'
import { Camera } from '../camera/camera'
import Attribute from '../geometry/attribute'
import { deepMerge, genId } from '../utils'

type ColorList = [Color, Color, Color, Color, Color]
type OffsetList = [number, number, number, number, number]

const defaultStyle = {
	colorList: [
		[1, 0, 0, 0],
		[1, 1, 0, 0],
		[0, 1, 0, 0],
		[0, 0, 1, 0],
		[0, 0, 0, 0]
	] as ColorList,
	colorOffsets: [1, 0.85, 0.55, 0.35, 0] as OffsetList,
	blur: 1,
	radius: 10,
	blending: 'normalBlending' as Blending
}

type IProps = {
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
	//heatPointsModel 和 maxHeatValueModel 都是在 preRender 阶段执行的渲染
	private heatPointsModel?: Model //负责将根据热力点的坐标和半径渲染各个像素的热力值到输出纹理的R 通道
	private maxHeatValueModel?: Model //负责根据 heatPointsModel 的输出纹理计算所有像素的最大热力值
	/**
	 * points 为热力点的二维坐标
	 * startTime 为热力点的播放时间，可选
	 * total 为预设的热力点数量，可以大于 points.length / 2
	 * style.colorList 为将浮点数的热力值插值为 rgb 颜色时的插值颜色数组
	 * style.colorOffsets 为颜色插值时各个颜色对应的区间取值为1到0，降序
	 * style.radius 为热力点的像素半径
	 * style.blur (0, 1]，maxHeatValue 对像素热力值做归一化时需先乘以该值
	 * @param props
	 */
	constructor(props: IProps) {
		const geometry = new Geometry()
		geometry.vertexCount = 6
		const { points, startTime } = props
		const style = deepMerge(defaultStyle, props.style || {})

		const mat = new Material({
			id: 'heat_mat_' + genId(),
			renderCode: renderShaderCode,
			vertexShaderEntry: 'vs',
			fragmentShaderEntry: 'fs',
			blending: props.style?.blending
		})

		super(geometry, mat)

		this._style = style

		this.material.updateUniform('maxHeatValueRatio', this.style.blur)
		this.material.updateUniform('colors', this.colorOffsets)

		this.points = points
		this.startTime = startTime
	}

	get style() {
		return this._style as typeof defaultStyle
	}

	get playable() {
		return !!this.startTime
	}

	/**
	 * heatValTex 作为 heatPointsModel 的输出纹理以及 maxHeatValueModel 的输入纹理在 R 通道记录了像素热力值
	 * size 为像素的宽高
	 * @param renderer
	 */
	private createHeatValueTexture(renderer: Renderer) {
		const { device, width, height } = renderer

		const heatValueTexture = device.createTexture({
			size: [width, height, 1],
			format: 'rgba16float', //因为需要使用纹理的 R 通道存放像素的热力值，故需要选择高精度的浮点数格式，而 rgba32float 又不支持multisample。
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		})
		this.updateTexture('heatValTex', heatValueTexture)
	}

	/**
	 * maxValTex 作为 maxHeatValueModel 输出纹理，记录了所有像素的最大热力值
	 * size 为1x1
	 * @param renderer
	 */
	private createMaxHeatValueTexture(renderer: Renderer) {
		const { device } = renderer

		const maxHeatValueTexture = device.createTexture({
			size: [1, 1, 1],
			format: 'rgba16float',
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
		})
		this.updateTexture('maxValTex', maxHeatValueTexture)
	}

	private createHeatPointsModel(renderer: Renderer) {
		const geo = new Geometry()
		const positionAttribute = new Attribute('position', this.points, 2, {
			stepMode: 'instance',
			shaderLocation: 0
		})
		geo.setAttribute('position', positionAttribute)

		if (this.startTime) {
			const startTimeAttribute = new Attribute('startTime', this.startTime, 1, {
				stepMode: 'instance',
				shaderLocation: 1
			})
			geo.setAttribute('startTime', startTimeAttribute)
		}

		geo.vertexCount = 6
		geo.instanceCount = this.points.length / 2

		const mat = new Material({
			id: 'compute heat value',
			renderCode: genComputeHeatValueShaderCode(!!this.startTime),
			vertexShaderEntry: 'vs',
			fragmentShaderEntry: 'fs',
			blending: 'additiveBlending', //混合阶段使同一像素上的不同热力点的热力值相加后输出到颜色纹理的 R 通道
			presentationFormat: 'rgba16float',
			multisampleCount: 1,
			uniforms: {
				size: this._style.radius
			}
		})
		this.heatPointsModel = new Model(geo, mat)
	}

	private createMaxHeatValueModel(renderer: Renderer) {
		const { width, height } = renderer
		const geo = new Geometry()
		geo.vertexCount = (width * height) / sampleRate / sampleRate //获取最大热力值时不用遍历全部像素点，进行降采样可以节省时间开销
		const mat = new Material({
			id: 'compute max heat value',
			renderCode: computeMaxHeatValueShaderCode,
			vertexShaderEntry: 'vs',
			fragmentShaderEntry: 'fs',
			blending: 'max', //由于输出纹理size 为1x1，所以vertexCount次执行片元着色器之后会将热力值写入同一个位置，在混合阶段通过最大值比较后可以获取最终的最大热力值
			presentationFormat: 'rgba16float',
			multisampleCount: 1,
			primitive: { topology: 'point-list' }
		})
		this.maxHeatValueModel = new Model(geo, mat)
	}

	lastResolution = { width: 0, height: 0 }
	private checkCreateHeatValueTexture(renderer: Renderer) {
		const { width, height } = renderer

		if (
			!this.textures['heatValTex'] ||
			width !== this.lastResolution.width ||
			height !== this.lastResolution.height
		) {
			this.createHeatValueTexture(renderer)
		}

		if ((width !== this.lastResolution.width || height !== this.lastResolution.height) && this.maxHeatValueModel) {
			this.maxHeatValueModel.geometry.vertexCount = (width * height) / sampleRate / sampleRate
		}

		this.lastResolution = { width, height }
	}

	get colorOffsets() {
		const res = new Float32Array(4 * 5)
		for (let i = 0; i < 5; ++i) {
			res[i * 4 + 0] = this.style.colorList[i][0]
			res[i * 4 + 1] = this.style.colorList[i][1]
			res[i * 4 + 2] = this.style.colorList[i][2]
			res[i * 4 + 3] = this.style.colorOffsets[i]
		}
		return res
	}

	public prevRender(renderer: Renderer, encoder: GPUCommandEncoder, camera: Camera) {
		this.checkCreateHeatValueTexture(renderer)
		if (!this.textures['maxValTex']) this.createMaxHeatValueTexture(renderer)
		if (!this.heatPointsModel) this.createHeatPointsModel(renderer)
		if (!this.maxHeatValueModel) this.createMaxHeatValueModel(renderer)
		const heatValTex = this.textures['heatValTex']
		if (this.heatPointsModel) {
			const heatRenderPassDesc: GPURenderPassDescriptor = {
				label: 'heat renderPass',
				colorAttachments: [
					{
						view: heatValTex.createView(),
						clearValue: [0, 0, 0, 0],
						loadOp: 'clear',
						storeOp: 'store'
					}
				]
			}
			const pass = encoder.beginRenderPass(heatRenderPassDesc)
			this.heatPointsModel.render(renderer, pass, camera)
			pass.end()
		}
		if (this.maxHeatValueModel) {
			const maxHeatValTex = this.textures['maxValTex']
			const renderPassDesc: GPURenderPassDescriptor = {
				label: 'mx heat renderPass',
				colorAttachments: [
					{
						view: maxHeatValTex.createView(),
						clearValue: [0, 0, 0, 0],
						loadOp: 'clear',
						storeOp: 'store'
					}
				]
			}
			const pass = encoder.beginRenderPass(renderPassDesc)
			//this.textures 中包含了 heatValTex 纹理，在 material.getBindGroups 中会根据 webgpu-utils 从 shader 代码中
			//获取到的纹理信息自动从 model.textures 中获取到相关纹理的作为 resource 添加到 bindGroup中，不需要显示绑定
			//但需要注意的是在同一个Model 中纹理名不要重复
			this.maxHeatValueModel.render(renderer, pass, camera, this.textures)
			pass.end()
		}
	}

	public updateCurrentTime(time: number): void {
		if (this.heatPointsModel) {
			this.heatPointsModel.material.updateUniform('currentTime', time)
		}
	}

	public dispose() {
		super.dispose()
		if (this.maxHeatValueModel) this.maxHeatValueModel.dispose()
		if (this.heatPointsModel) this.heatPointsModel.dispose()
	}
}

export default Heatmap
