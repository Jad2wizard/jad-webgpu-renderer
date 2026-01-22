import GMap from '../index'

export default class BoxSelectWidget {
	private container: HTMLElement
	private dom: HTMLDivElement
	private startLeft = 0
	private startTop = 0
	private active = false

	constructor(map: GMap) {
		this.container = map.container
		this.dom = document.createElement('div')
		this.initStyle()
		this.container.appendChild(this.dom)
		this.hide()
	}

	private initStyle() {
		const style = this.dom.style
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
	}

	private hide() {
		this.dom.style.display = 'none'
	}

	private show() {
		this.dom.style.display = 'block'
	}

	start(left: number, top: number) {
		this.active = true
		this.startLeft = left
		this.startTop = top
		this.show()
		this.update(left, top)
	}

	update(left: number, top: number) {
		if (!this.active) return
		const minLeft = Math.min(this.startLeft, left)
		const minTop = Math.min(this.startTop, top)
		const width = Math.abs(this.startLeft - left)
		const height = Math.abs(this.startTop - top)
		const style = this.dom.style
		style.left = `${minLeft}px`
		style.top = `${minTop}px`
		style.width = `${width}px`
		style.height = `${height}px`
	}

	end() {
		this.active = false
		this.hide()
	}

	dispose() {
		if (this.dom && this.dom.parentElement) {
			this.dom.parentElement.removeChild(this.dom)
		}
	}
}

