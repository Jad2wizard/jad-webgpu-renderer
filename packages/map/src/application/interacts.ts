import GMap from './index'

type IProps = {
	map: GMap
}

class Interacts {
	private map: GMap
	private mouseCoord: { left: number; top: number; x: number; y: number }
	private mouseDownCoord: { left: number; top: number; x: number; y: number }
	private dragging = false
	private boxSelecting = false

	//以下三个参数用于在 onMouseUp 中判断鼠标点击事件是click 还是 dblclick
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
		this.mouseDownCoord = this.calcCoord(e)
		this.map.handleInteractEvent('mousedown', this.mouseDownCoord)
		if (this.map.boxSelectEnabled && this.isBoxSelectTrigger(e)) {
			this.boxSelecting = true
			this.dragging = false
			this.map.view.setControlsEnabled(false)
			this.map.boxSelectWidget?.start(this.mouseDownCoord.left, this.mouseDownCoord.top)
			return
		}
		this.dragging = true
	}

	//记录鼠标实时坐标，并通过 map 触发 mousemove 事件
	private onMouseMove = (e: MouseEvent) => {
		this.mouseCoord = this.calcCoord(e)
		if (this.boxSelecting) {
			this.map.boxSelectWidget?.update(this.mouseCoord.left, this.mouseCoord.top)
			return
		}
		if (this.dragging) {
			this.map.handleInteractEvent('drag', this.mouseCoord)
		} else {
			this.map.handleInteractEvent('hover', this.mouseCoord)
		}
	}

	private onMouseUp = (e: MouseEvent) => {
		const mouseCoord = this.calcCoord(e)
		this.dragging = false
		if (this.boxSelecting) {
			this.boxSelecting = false
			this.map.view.setControlsEnabled(true)
			this.map.boxSelectWidget?.update(mouseCoord.left, mouseCoord.top)
			this.map.boxSelectWidget?.end()
			const moveDistance =
				Math.abs(mouseCoord.left - this.mouseDownCoord.left) +
				Math.abs(mouseCoord.top - this.mouseDownCoord.top)
			if (moveDistance <= Interacts.CLICK_THRESHOLD) {
				return
			}
			this.pickBox(this.mouseDownCoord, mouseCoord)
			return
		}
		this.map.handleInteractEvent('mouseup', this.mouseCoord)
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
					// 先触发不带数据的 click 事件
					this.map.handleInteractEvent('click', mouseCoord)
					// 然后执行拾取，如果拾取到数据，会再次触发 click 事件（带 data）
					this.pick(mouseCoord)
				} else if (e.button === 2) {
					this.map.handleInteractEvent('rightClick', mouseCoord)
				}
				this.firstClickTime = 0
				this.clickTimer = null
			}, this.clickDelay)
		} else if (performance.now() - this.firstClickTime < this.clickDelay) {
			this.map.handleInteractEvent('dblclick', mouseCoord)
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

	private pick(mouseCoord: { left: number; top: number; x: number; y: number }) {
		const layers = this.map.layerManager.layers
		for (let layer of layers) {
			if (layer.pick) {
				const s = performance.now()
				const data = layer.pick(mouseCoord.x, mouseCoord.y)
				if (data.length > 0) {
					console.log('Picked points :', data)
					console.log('Pick time:', performance.now() - s)
					//@ts-ignore
					console.log(
						'used js heap size: ',
						//@ts-ignore
						performance.memory.usedJSHeapSize / 1024 ** 2
					)
					this.map.handleInteractEvent('click', { ...mouseCoord, data })
				}
			}
		}
	}

	private pickBox(
		start: { left: number; top: number; x: number; y: number },
		end: { left: number; top: number; x: number; y: number }
	) {
		const layers = this.map.layerManager.layers
		const minX = Math.min(start.x, end.x)
		const maxX = Math.max(start.x, end.x)
		const minY = Math.min(start.y, end.y)
		const maxY = Math.max(start.y, end.y)
		const resolution = this.map.view.getResolution()
		const results: { layerId: string; data: number[] }[] = []
		console.log(minX, maxX, minY, maxY)
		for (let layer of layers) {
			if (layer.pickBox) {
				const data = layer.pickBox(minX, minY, maxX, maxY, resolution)
				if (data.length > 0) {
					console.log(`pick box: ${data}`)
					results.push({ layerId: layer.getId(), data })
				}
			}
		}
		if (results.length > 0) {
			const left = Math.min(start.left, end.left)
			const right = Math.max(start.left, end.left)
			const top = Math.min(start.top, end.top)
			const bottom = Math.max(start.top, end.top)
			this.map.emit('boxselect', { left, right, top, bottom, data: results })
		}
	}

	private isBoxSelectTrigger(e: MouseEvent) {
		const key = this.map.boxSelectKey
		if (key === 'ctrl') return e.ctrlKey
		if (key === 'shift') return e.shiftKey
		if (key === 'alt') return e.altKey
		if (key === 'meta') return e.metaKey
		return false
	}
}

export default Interacts
