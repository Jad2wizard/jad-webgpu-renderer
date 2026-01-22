import { Vector2, MOUSE, Raycaster, Plane, Vector3 } from 'three'
import { PerspectiveCamera } from '@webgpu-gmap/renderer'
import proj4 from 'proj4'
import { Extent } from '@map/types'
import TileMap from './tile'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

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

// Web Mercator 投影中，zoom 0 时地球赤道周长对应的分辨率（米/像素）
const INITIAL_RESOLUTION = 156543.03392804097

// 根据 zoom 级别和 FOV 计算相机高度
function calcCameraHeightFromZoom(zoom: number, screenHeight: number, fov: number): number {
	// 计算当前 zoom 级别的分辨率（米/像素）
	const resolution = INITIAL_RESOLUTION / Math.pow(2, zoom)
	// 相机高度 = (分辨率 * 屏幕高度 / 2) / tan(fov/2)
	// fov 是以度为单位，需要转换为弧度
	console.log(fov)
	const fovRad = (fov * Math.PI) / 180
	const halfScreenWorldSize = (resolution * screenHeight) / 2
	return halfScreenWorldSize / Math.tan(fovRad / 2)
}

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
	private fov: number

	private R = 6378137
	private MAX_LAT = 85.0511287798

	constructor(props: IProps) {
		this.width = props.width
		this.height = props.height
		this.tileMap = props.tileMap
		this.fov = this.calcFov(this.height)

		const aspect = this.width / this.height
		this._camera = new PerspectiveCamera(this.fov, aspect, 1, 10000000)
		this.controls = this.initCamera(props)
		this.bindEvents()
	}

	get resolution() {
		return this.tileMap.getResolution()
	}

	get camera() {
		return this._camera
	}

	public getZoom() {
		// 根据相机高度反推 zoom
		const height = this.camera.position.z
		const fovRad = (this.fov * Math.PI) / 180
		const halfScreenWorldSize = height * Math.tan(fovRad / 2)
		const resolution = (halfScreenWorldSize * 2) / this.height
		return Math.log2(INITIAL_RESOLUTION / resolution)
	}

	// 获取当前像素分辨率（米/像素）
	public getResolution() {
		return INITIAL_RESOLUTION / Math.pow(2, this.getZoom())
	}

	public animate() {
		this.camera.updateMatrixWorld()
		this.camera.updateProjectionMatrix()
	}

	public setControlsEnabled(enabled: boolean) {
		this.controls.enabled = enabled
	}

	public setCenter(center: [number, number]) {
		const world = this.lonlat2World(center[0], center[1])
		this.camera.position.x = world.x
		this.camera.position.y = world.y
		this.controls.target.set(world.x, world.y, 0)
		this.controls.update()
	}

	public setZoom(zoom: number) {
		const height = calcCameraHeightFromZoom(zoom, this.height, this.fov)
		this.camera.position.z = height
		this.controls.update()
	}

	public resize(width: number, height: number) {
		this.width = width
		this.height = height
		// 更新相机的宽高比
		const aspect = this.width / this.height
		this._camera.aspect = aspect
		// 重新计算FOV以保持合适的视野
		this.fov = this.calcFov(this.height)
		this._camera.fov = this.fov
		this._camera.updateProjectionMatrix()
		this.onViewChange()
	}

	public fitBounds(extent: Extent) {
		const { w, s, e, n } = extent
		const centerLon = (w + e) / 2
		const centerLat = (s + n) / 2

		const min = this.lonlat2World(w, s)
		const max = this.lonlat2World(e, n)

		const widthWorld = Math.abs(max.x - min.x)
		const heightWorld = Math.abs(max.y - min.y)

		const padding = 1.1

		const resX = (widthWorld * padding) / this.width
		const resY = (heightWorld * padding) / this.height

		const resolution = Math.max(resX, resY)

		const zoom = Math.log2(INITIAL_RESOLUTION / resolution)

		this.setCenter([centerLon, centerLat])
		this.setZoom(zoom)
	}

	public lonlat2World(lon: number, lat: number) {
		const [x, y] = this.proj.forward([lon, lat])
		return new Vector2(x - this.offset.x, y - this.offset.y)
	}

	public lonlat2WorldFast(lon: number, lat: number) {
		const { x, y } = this.projectFast(lon, lat)
		return { x: x - this.offset.x, y: y - this.offset.y }
	}

	private projectFast(lon: number, lat: number) {
		const d = Math.PI / 180
		const max = this.MAX_LAT
		const latVal = Math.max(Math.min(max, lat), -max)
		const x = this.R * lon * d
		const y = this.R * Math.log(Math.tan(Math.PI / 4 + (latVal * d) / 2))
		return { x, y }
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

		const defaultZoom = this.tileMap.view.getZoom() || 7
		const cameraHeight = calcCameraHeightFromZoom(defaultZoom, this.height, this.fov)

		this.camera.position.set(centerWorld.x, centerWorld.y, cameraHeight)
		//@ts-ignore
		window.cam = this.camera
		const controls = new OrbitControls(this.camera, props.controlCanvas)
		controls.target.set(this.camera.position.x, this.camera.position.y, 0)
		controls.mouseButtons.LEFT = MOUSE.PAN
		controls.enableRotate = false
		this.camera.lookAt(controls.target)
		return controls
	}

	/**
	 * 以1000像素高度下45度fov为基准，计算任意屏幕高度下的fov。以达到不同屏幕高度下地图上物体相同的视觉比例
	 * @param height 屏幕 像素高度
	 * @returns 任意屏幕高度下的fov
	 */
	private calcFov(height: number) {
		const tanAlpha: number = Math.tan((45 * Math.PI) / 360)
		let res = (Math.atan2(height, 1000 / tanAlpha) * 360) / Math.PI
		console.log(res)
		// res = 50.74
		return res
	}

	private onViewChange = () => {
		const fovRad = (this.camera.fov * Math.PI) / 180
		const resolution = (this.camera.position.z * Math.tan(fovRad / 2) * 2) / this.height

		const zoom = Math.log2(INITIAL_RESOLUTION / resolution)

		const { position } = this.camera
		const center = this.world2Lonlat(new Vector2(position.x, position.y))

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
