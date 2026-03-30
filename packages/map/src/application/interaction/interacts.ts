import GMap from '../index'

export type InteractionConfig = {
	boxSelect?: {
		enabled?: boolean
		key?: 'ctrl' | 'shift' | 'alt' | 'meta'
	}
}

type IProps = {
	map: GMap
	config?: InteractionConfig
}

type Coord = { left: number; top: number; x: number; y: number }

class Interacts {
	private map: GMap
	private config?: InteractionConfig
	private mouseCoord: Coord
	private mouseDownCoord: Coord
	private dragging = false
	private boxSelecting = false
	private firstClickTime = 0
	private clickTimer: NodeJS.Timeout | null = null
	private clickDelay = 250
	private boxSelectDom?: HTMLDivElement
	private boxSelectStartLeft = 0
	private boxSelectStartTop = 0

	private static readonly CLICK_THRESHOLD = 4

	constructor(props: IProps) {
		this.map = props.map
		this.config = props.config
		this.mouseCoord = { left: 0, top: 0, x: 0, y: 0 }
		this.mouseDownCoord = { left: 0, top: 0, x: 0, y: 0 }
		if (this.config?.boxSelect?.enabled) {
			this.initBoxSelectDom()
		}
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
		if (this.config?.boxSelect?.enabled && this.isBoxSelectTrigger(e)) {
			this.boxSelecting = true
			this.dragging = false
			this.map.view.setControlsEnabled(false)
			this.startBoxSelect(this.mouseDownCoord.left, this.mouseDownCoord.top)
			return
		}
		this.dragging = true
	}

	private onMouseMove = (e: MouseEvent) => {
		this.mouseCoord = this.calcCoord(e)
		if (this.boxSelecting) {
			this.updateBoxSelect(this.mouseCoord.left, this.mouseCoord.top)
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
			this.updateBoxSelect(mouseCoord.left, mouseCoord.top)
			this.endBoxSelect()
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
					this.map.handleInteractEvent('click', mouseCoord)
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
		if (this.boxSelectDom?.parentElement) {
			this.boxSelectDom.parentElement.removeChild(this.boxSelectDom)
		}
	}

	private pick(mouseCoord: Coord) {
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

	private pickBox(start: Coord, end: Coord) {
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
		const key = this.config?.boxSelect?.key || 'ctrl'
		if (key === 'ctrl') return e.ctrlKey
		if (key === 'shift') return e.shiftKey
		if (key === 'alt') return e.altKey
		if (key === 'meta') return e.metaKey
		return false
	}

	private initBoxSelectDom() {
		this.boxSelectDom = document.createElement('div')
		const style = this.boxSelectDom.style
		style.position = 'absolute'
		style.left = '0'
		style.top = '0'
		style.width = '0'
		style.height = '0'
		style.border = '1px dashed #4aa3ff'
		style.backgroundColor = 'rgba(74, 163, 255, 0.15)'
		style.pointerEvents = 'none'
		style.zIndex = '120'
		style.userSelect = 'none'
		style.display = 'none'
		this.map.container.appendChild(this.boxSelectDom)
	}

	private startBoxSelect(left: number, top: number) {
		const localCoord = this.toLocalCoord(left, top)
		this.boxSelectStartLeft = localCoord.left
		this.boxSelectStartTop = localCoord.top
		if (this.boxSelectDom) {
			this.boxSelectDom.style.display = 'block'
		}
		this.updateBoxSelect(left, top)
	}

	private updateBoxSelect(left: number, top: number) {
		if (!this.boxSelectDom || !this.boxSelecting) return
		const localCoord = this.toLocalCoord(left, top)
		const minLeft = Math.min(this.boxSelectStartLeft, localCoord.left)
		const minTop = Math.min(this.boxSelectStartTop, localCoord.top)
		const width = Math.abs(this.boxSelectStartLeft - localCoord.left)
		const height = Math.abs(this.boxSelectStartTop - localCoord.top)
		const style = this.boxSelectDom.style
		style.left = `${minLeft}px`
		style.top = `${minTop}px`
		style.width = `${width}px`
		style.height = `${height}px`
	}

	private endBoxSelect() {
		if (this.boxSelectDom) {
			this.boxSelectDom.style.display = 'none'
		}
	}

	private toLocalCoord(left: number, top: number) {
		const rect = this.map.container.getBoundingClientRect()
		return {
			left: left - rect.left,
			top: top - rect.top,
		}
	}
}

export default Interacts
