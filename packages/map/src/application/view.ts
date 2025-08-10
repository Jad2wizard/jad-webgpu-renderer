import { Vector2, MOUSE, Raycaster, Plane, Vector3 } from 'three'
import { PerspectiveCamera } from '@gmap/renderer'
import proj4 from 'proj4'
import { Extent } from '@/types'
import TileMap from './tile'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

type IProps = {
	tileMap: TileMap
	width: number
	height: number
	extent: Extent
	center?: { lon: number; lat: number }
	controlCanvas: HTMLCanvasElement
}

const SHIFT = 16
const CTRL = 17
const defaultCameraHeight = 2000000

class View {
	private tileMap: TileMap
	private width: number
	private height: number
	private offset = new Vector2()
	private proj = proj4('EPSG:3857')
	private raycaster = new Raycaster()
	private _camera: PerspectiveCamera
	private plane = new Plane(new Vector3(0, 0, 1), 0)
	private controls: OrbitControls

	constructor(props: IProps) {
		this.width = props.width
		this.height = props.height
		this.tileMap = props.tileMap

		const aspect = this.width / this.height
		this._camera = new PerspectiveCamera(this.calcFov(this.height), aspect, 10, 10000000)
		this.controls = this.initCamera(props)
		this.bindEvents()
	}

	get resolution() {
		return this.tileMap.getResolution()
	}

	get camera() {
		return this._camera
	}

	public animate() {
		this.camera.updateMatrixWorld()
		this.camera.updateProjectionMatrix()
	}

	public lonlat2World(lon: number, lat: number) {
		const [x, y] = this.proj.forward([lon, lat])
		return new Vector2(x - this.offset.x, y - this.offset.y)
	}

	public world2Lonlat(coord: Vector2): [number, number] {
		return this.proj.inverse([coord.x + this.offset.x, coord.y + this.offset.y])
	}

	public screen2World(left: number, top: number) {
		const mouse = new Vector2()
		mouse.x = (left / this.width) * 2 - 1
		mouse.y = -(top / this.height) * 2 + 1
		this.raycaster.setFromCamera(mouse, this.camera)
		const pos = new Vector3()
		this.raycaster.ray.intersectPlane(this.plane, pos)
		return new Vector2(pos.x, pos.y)
	}

	public world2Screen(coord: Vector2) {
		const w = new Vector3(coord.x, coord.y, 0)
		const ndc = w.project(this.camera)
		const left = Math.round(((ndc.x + 1) * this.width) / 2)
		const top = Math.round(((-ndc.y + 1) * this.height) / 2)
		return new Vector2(left, top)
	}

	public lonlat2Screen(lon: number, lat: number) {
		const world = this.lonlat2World(lon, lat)
		return this.world2Screen(world)
	}

	public screen2Lonlat(left: number, top: number) {
		const world = this.screen2World(left, top)
		return this.world2Lonlat(world)
	}

	private initCamera(props: IProps) {
		const center = props.center ? [props.center.lon, props.center.lat] : [120, 30]
		const centerWorld = this.lonlat2World(center[0], center[1])
		this.camera.position.set(centerWorld.x, centerWorld.y, defaultCameraHeight)
		//@ts-ignore
		window.cam = this.camera
		const controls = new OrbitControls(this.camera, props.controlCanvas)
		controls.target.set(this.camera.position.x, this.camera.position.y, 0)
		controls.mouseButtons.LEFT = MOUSE.PAN
		controls.enableRotate = false
		this.camera.lookAt(controls.target)
		return controls
	}

	private calcFov(height: number) {
		const tanAlpha: number = Math.tan((45 * Math.PI) / 360)
		return (Math.atan2(height * tanAlpha, 1000) * 360) / Math.PI
	}

	private onViewChange = () => {
		const { position } = this.camera
		const center = this.world2Lonlat(new Vector2(position.x, position.y))

		const ne = this.screen2Lonlat(this.width, 0)
		const sw = this.screen2Lonlat(0, this.height)

		const extent = { n: ne[1], e: ne[0], s: sw[1], w: sw[0] }
		const zoom = this.tileMap.calcZoomFromExtent(extent, this.width, this.height)

		this.tileMap.updateView({ center: { lon: center[0], lat: center[1] }, zoom })
	}

	private onKeyDown = (e: KeyboardEvent) => {
		if (e.keyCode === SHIFT) {
			this.controls.zoomSpeed = 5
		}
	}

	private onKeyUp = (e: KeyboardEvent) => {
		if (e.keyCode === SHIFT) {
			this.controls.zoomSpeed = 1
		}
	}

	private bindEvents() {
		this.controls.addEventListener('change', this.onViewChange)
		window.addEventListener('keydown', this.onKeyDown)
		window.addEventListener('keyup', this.onKeyUp)
	}

	private unbindEvents() {
		this.controls.removeEventListener('change', this.onViewChange)
		window.removeEventListener('keydown', this.onKeyDown)
		window.removeEventListener('keyup', this.onKeyUp)
	}

	dispose() {
		this.unbindEvents()
	}
}

export default View
