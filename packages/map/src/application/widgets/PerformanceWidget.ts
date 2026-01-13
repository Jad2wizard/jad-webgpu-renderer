import GMap from '../index'

export default class PerformanceWidget {
	private container: HTMLElement
	private dom: HTMLDivElement
	private map: GMap
	private timer: any

	constructor(map: GMap) {
		this.map = map
		this.container = map.container
		this.dom = document.createElement('div')
		this.initStyle()
		this.container.appendChild(this.dom)
		this.start()
	}

	private initStyle() {
		const style = this.dom.style
		style.position = 'absolute'
		style.top = '10px'
		style.left = '10px'
		style.padding = '8px'
		style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
		style.color = 'white'
		style.borderRadius = '4px'
		style.fontFamily = 'monospace'
		style.fontSize = '12px'
		style.pointerEvents = 'none'
		style.zIndex = '100'
		style.lineHeight = '1.5'
		style.userSelect = 'none'
	}

	private start() {
		this.update()
		this.timer = setInterval(() => {
			this.update()
		}, 1000)
	}

	private update() {
		const renderer = this.map.renderer.webgpuRenderer
		if (!renderer) return

		const { fps, memory } = renderer.getPerformanceInfo()

		let text = `FPS: ${fps}`
		if (memory) {
			const used = (memory.usedJSHeapSize / 1024 / 1024).toFixed(1)
			const total = (memory.totalJSHeapSize / 1024 / 1024).toFixed(1)
			text += `<br/>Memory: ${used} / ${total} MB`
		}

		this.dom.innerHTML = text
	}

	public dispose() {
		if (this.timer) {
			clearInterval(this.timer)
		}
		if (this.dom && this.dom.parentElement) {
			this.dom.parentElement.removeChild(this.dom)
		}
	}
}
