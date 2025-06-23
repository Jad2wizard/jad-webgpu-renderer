import { Vector2 } from 'three'
import PerspectiveCamera from '@/camera/perspectiveCamera'
import Renderer from '../Renderer'
import Scene from '../Scene'
import Points from '../Points/Points'

async function initApp() {
	//@ts-ignore
	window.V = Vector2

	const canvas = document.querySelector('#canvas') as HTMLCanvasElement
	canvas.width = canvas.offsetWidth
	canvas.height = canvas.offsetHeight

	const camera = new PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 10000)
	camera.position.set(0, 0, 500)
	//@ts-ignore
	window.c = camera

	const scene = new Scene()
	//@ts-ignore
	window.s = scene
	const renderer = await Renderer.create({ canvas, antialias: true, clearColor: [0, 0, 0, 0.3] })
	// const renderer = await Renderer.create({ canvas, antiAlias: true, clearColor: [0, 0, 0, 0.3] })
	//@ts-ignore
	window.r = renderer

	// const pos = new Float32Array([30, 20, 0, 20, 0, 0, -40, 0])
	const totalTime = 20
	const num = 10000
	let pos = new Float32Array(num * 2)
	const color = new Uint8Array(num * 4)
	const size = new Uint8Array(num)
	const timestamps = new Float32Array(num)
	for (let i = 0; i < num; ++i) {
		pos[2 * i] = (800 / num) * i - 350
		pos[2 * i + 1] = Math.sin(((2 * Math.PI) / num) * i) * 100
		color[i * 4 + 0] = 1 * 255
		color[i * 4 + 1] = ((num - i) / num) * 1 * 255
		color[i * 4 + 2] = 0 * 255
		color[i * 4 + 3] = 0.1 * 255
		size[i] = Math.abs(Math.sin(((2 * Math.PI) / num) * i)) * 10 + 10
		timestamps[i] = (totalTime / num) * i
	}
	const step = Math.ceil(num / 10)
	const points = new Points({
		position: pos.subarray(0, step * 2),
		// color: color.subarray(0, step * 4),
		// radius: size.subarray(0, step),
		// startTime: timestamps.subarray(0, 50),
		// position: pos,
		// // color,
		// radius: size,
		// startTime: timestamps,
		// total: num,
		style: {
			color: [1, 0.9, 0.2, 0.9],
			blending: 'normalBlending',
			radius: 10,
		},
	})
	//@ts-ignore
	window.p = points

	let i = step
	const timer = setInterval(() => {
		if (i > num) {
			clearInterval(timer)
		} else {
			points.appendPoints({
				position: pos.subarray(i * 2, (i + step) * 2),
				// startTime: timestamps.subarray(i, i + 50),
				// color: color.subarray(i * 4, (i + step) * 4),
				// radius: size.subarray(i, i + step),
			})
		}
		i += step
	}, 500)
	scene.addModel(points)

	const animate = (time: number) => {
		renderer.render(scene, camera)
		requestAnimationFrame(animate)
	}
	requestAnimationFrame(animate)

	window.addEventListener('resize', renderer.resize)
}

initApp()
