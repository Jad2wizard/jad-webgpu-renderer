import { Vector2 } from 'three'
import PerspectiveCamera from '@/camera/perspectiveCamera'
import Renderer from '../Renderer'
import Scene from '../Scene'
import Points from '../Points/Points'
import { Paths } from '../Path/Paths'
import { times } from 'lodash'
// import * as moment from 'moment'

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
		// pos[2 * i] = (Math.random() * 2 - 1) * 400
		// pos[2 * i + 1] = (Math.random() * 2 - 1) * 200
		color[i * 4 + 0] = 1 * 255
		color[i * 4 + 1] = ((num - i) / num) * 1 * 255
		color[i * 4 + 2] = 0 * 255
		color[i * 4 + 3] = 0.3 * 255
		size[i] = Math.abs(Math.sin(((2 * Math.PI) / num) * i)) * 10 + 10
		// size[i] = 10
		timestamps[i] = (totalTime / num) * i
	}
	// console.log(timestamps)

	// size[9] = 10
	// size[8] = 10
	// const path = new Path({
	// 	positions: pos.map((p, i) => (i % 2 === 1 ? p * 1.3 : p)),
	// 	timestamps,
	// 	material: {
	// 		color: [0.0, 0.9, 1, 0.7],
	// 		lineWidth: 10,
	// 		blending: 'normalBlending'
	// 	}
	// })

	console.log(timestamps)
	const paths = new Paths(
		[
			{
				pathId: '1',
				position: pos,
				startTime: timestamps,
				style: {
					// 	color: [1, 0.3, 0.2, 0.7],
					// 	lineWidth: 10,
					// 	headPointColor: [1, 0.9, 0.3, 1],
					// 	headPointSize: 10,
					// 	headPointVisible: false,
					// 	blending: 'normalBlending',
					// 	drawLine: false,
					tailDuration: 3,
				},
			},
			{
				pathId: '2',
				position: pos.map((p, i) => (i % 2 === 1 ? p * -1.1 : p)),
				startTime: timestamps,
				style: {
					color: [1, 1, 0, 0.7],
					// 	lineWidth: 5,
					// 	blending: 'normalBlending',
					headPointVisible: true,
					headPointSize: 15,
					drawLine: true,
					tailDuration: 5,
					// 	// colorBySpeed: true,
					// 	unplayedColor: [1, 0.7, 0.2, 0.5],
				},
			},
		],
		{
			color: [1, 0.3, 0.2, 0.9],
			lineWidth: 10,
			headPointColor: [1, 0.9, 0.3, 1],
			headPointSize: 10,
			headPointVisible: false,
			blending: 'normalBlending',
			drawLine: false,
			tailDuration: 0,
		}
	)
	//@ts-ignore
	window.t = paths

	// setTimeout(() => {
	// 	paths.appendPaths([
	// 		{
	// 			pathId: '1',
	// 			position: pos,
	// 			startTime: timestamps,
	// 			// colorBySpeed: true,
	// 			style: {
	// 				color: [1, 0.3, 0.2, 0.5],
	// 				lineWidth: 6,
	// 				headPointColor: [1, 0.9, 0.3, 1],
	// 				headPointSize: 10,
	// 				headPointVisible: false,
	// 				blending: 'normalBlending',
	// 				drawLine: false,
	// 				tailDuration: 0,
	// 			},
	// 		},
	// 	])
	// }, 2000)

	pos = pos.map((p, i) => (i % 2 === 1 ? p * 1.5 : p))
	const points = new Points({
		id: 'demo-points-1',
		// position: pos.subarray(0, 100),
		// color: color.subarray(0, 200),
		// radius: size.subarray(0, 50),
		// startTime: timestamps.subarray(0, 50),
		position: pos,
		// color,
		radius: size,
		// startTime: timestamps,
		// total: 400,
		style: {
			color: [1, 0.9, 0.2, 0.9],
			blending: 'normalBlending',
			radius: 10,
		},
	})
	//@ts-ignore
	window.p = points

	// let i = 50

	// const timer = setInterval(() => {
	// 	if (i > num) {
	// 		clearInterval(timer)
	// 	} else {
	// 		points.appendPoints({
	// 			position: pos.subarray(i * 2, (i + 50) * 2),
	// 			startTime: timestamps.subarray(i, i + 50),
	// 			color: color.subarray(i * 4, (i + 50) * 4),
	// 			radius: size.subarray(i, i + 50),
	// 		})
	// 		// heat.appendHeatPoints(heatPoints.subarray(i * 2, (i + 50) * 2), timestamps.subarray(i, i + 50))
	// 	}
	// 	i += 50
	// }, 500)
	// // line.visible = false
	// heat.renderOrder = 1
	// points.renderOrder = 0
	// path.renderOrder = 2
	scene.addModel(points)
	scene.addModel(paths)

	let interval = 60
	let lastTimestamp = 0
	let start = 0
	const animate = (time: number) => {
		// console.log(time)
		if (start === 0) {
			lastTimestamp = time
			start = lastTimestamp
		}
		const timeElapsed = time - lastTimestamp
		// if (timeElapsed >= interval) {
		// 	// points.updateCurrentTime(((time - start) * (totalTime / 400 / 20)) % timestamps[num - 1])
		// 	// heat.updateCurrentTime(((time - start) * (totalTime / 400 / 20)) % timestamps[num - 1])
		// 	// renderer.render(scene, camera)
		// 	lastTimestamp = time
		// }
		const ct = ((time - start) * (totalTime / 400 / 20)) % timestamps[num - 1]
		// console.log(ct)
		paths.updateCurrentTime(ct)
		// heat.updateCurrentTime(((time - start) * (totalTime / 400 / 20)) % timestamps[num - 1])
		renderer.render(scene, camera)
		requestAnimationFrame(animate)
	}
	requestAnimationFrame(animate)

	window.addEventListener('resize', renderer.resize)
}

initApp()
