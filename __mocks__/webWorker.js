export default class {
	constructor(url) {
		this.url = url
		this.onmessage = () => {}
	}

	postMessage(msg) {
		this.onmessage(msg)
	}
}
