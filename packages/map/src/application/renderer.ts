import { Renderer as WebGPURenderer, Camera, Scene } from '@gmap/renderer'

type IProps = {
	container: HTMLElement
	antialias: boolean
}

class Renderer {
	private _renderer: WebGPURenderer
	private _canvas: HTMLCanvasElement
	private _antialias: boolean

	constructor(props: IProps) {
		const canvas = document.createElement('canvas')
		canvas.width = props.container.offsetWidth
		canvas.height = props.container.offsetHeight
		props.container.appendChild(canvas)
		canvas.style.width = '100%'
		canvas.style.height = '100%'
		canvas.style.position = 'absolute'
		canvas.style.zIndex = '2'
		this._canvas = canvas
		this._antialias = props.antialias
	}

	async init() {
		const renderer = await WebGPURenderer.create({
			canvas: this._canvas,
			antialias: this._antialias,
			clearColor: [0, 0, 0, 0.3],
		})
		this._renderer = renderer
		//@ts-ignore
		window.r = this._renderer
	}

	get canvas() {
		return this._canvas
	}

	public render(scene: Scene, camera: Camera) {
		this._renderer.render(scene, camera)
	}

	public resize() {
		this._renderer.resize()
	}

	public dispose(parentElement: HTMLElement) {
		parentElement.removeChild(this._canvas)
	}
}

export default Renderer
