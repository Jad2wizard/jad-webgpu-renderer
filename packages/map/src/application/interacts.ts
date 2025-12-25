import GMap from './index'

type IProps = {
	map: GMap
}

class Interacts {
	private map: GMap
	private mouseCoord: { left: number; top: number; x: number; y: number }
	private mouseDownCoord: { left: number; top: number; x: number; y: number }
	private dragging = false

	//以下三个参数用于在 onMouseUp 中判断鼠标点击事件是click 还是 dbclick
	private firstClickTime = 0
	private clickTimer: NodeJS.Timeout | null = null
	private clickDelay = 250

	// 点击和拖拽的距离阈值（像素）
	private static readonly CLICK_THRESHOLD = 4

	constructor(props: IProps) {
		this.map = props.map
		this.mouseCoord = { left: 0, top: 0, x: 0, y: 0 }
		this.mouseDownCoord = { left: 0, top: 0, x: 0, y: 0 }
		const element = this.map.container
		element.addEventListener('mousedown', this.onMouseDown)
		element.addEventListener('mousemove', this.onMouseMove)
		element.addEventListener('mouseup', this.onMouseUp)
	}

	private calcCoord(e: MouseEvent) {
		const left = e.clientX
		const top = e.clientY
		const worldCood = this.map.view.screen2World(left, top)
		return { left, top, x: worldCood.x, y: worldCood.y }
	}

	private onMouseDown = (e: MouseEvent) => {
		this.dragging = true
		this.mouseDownCoord = this.calcCoord(e)
		this.map.emit('mousedown', this.mouseCoord)
	}

	//记录鼠标实时坐标，并通过 map 触发 mousemove 事件
	private onMouseMove = (e: MouseEvent) => {
		this.mouseCoord = this.calcCoord(e)
		if (this.dragging) {
			this.map.emit('drag', this.mouseCoord)
		} else {
			this.map.emit('hover', this.mouseCoord)
		}
	}

	private onMouseUp = (e: MouseEvent) => {
		const mouseCoord = this.calcCoord(e)
		this.dragging = false
		this.map.emit('mouseup', this.mouseCoord)
		if (
			Math.abs(mouseCoord.left - this.mouseDownCoord.left) +
				Math.abs(mouseCoord.top - this.mouseDownCoord.top) >
			Interacts.CLICK_THRESHOLD
		) {
			return
		}

		if (!this.firstClickTime) {
			this.firstClickTime = performance.now()
			this.clickTimer = setTimeout(() => {
				if (e.button === 0) {
					this.map.emit('click', mouseCoord)
				} else if (e.button === 2) {
					this.map.emit('rightClick', mouseCoord)
				}
				this.firstClickTime = 0
				this.clickTimer = null
			}, this.clickDelay)
		} else if (performance.now() - this.firstClickTime < this.clickDelay) {
			this.map.emit('dbclick', mouseCoord)
			if (this.clickTimer) {
				clearTimeout(this.clickTimer)
				this.clickTimer = null
				this.firstClickTime = 0
			}
		}
	}

	dispose() {
		const element = this.map.container
		element.removeEventListener('mousedown', this.onMouseDown)
		element.removeEventListener('mousemove', this.onMouseMove)
		element.removeEventListener('mouseup', this.onMouseUp)
		if (this.clickTimer) {
			clearTimeout(this.clickTimer)
			this.clickTimer = null
		}
	}
}

export default Interacts
