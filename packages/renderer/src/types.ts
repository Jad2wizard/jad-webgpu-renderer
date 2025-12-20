import Renderer from './Renderer'
import { Camera } from './camera/camera'
import { Pass } from './pass/Pass'

export type TypedArray =
	| Float32Array
	| Float64Array
	| Uint8Array
	| Uint16Array
	| Uint32Array
	| Int8Array
	| Int16Array
	| Int32Array

export type Blending = 'normalBlending' | 'additiveBlending' | 'max' | 'min' | 'none'

export type Color = [number, number, number, number]

export interface IBuffer {}

export interface IRenderable {
	getPasses(renderer: Renderer, camera: Camera, loadOp?: GPULoadOp): Pass[]

	render(
		renderer: Renderer,
		pass: GPURenderPassEncoder,
		camera: Camera,
		textures?: Record<string, GPUTexture>
	): void

	dispose(): void

	get id(): string

	set id(s: string)

	get visible(): boolean

	set visible(v: boolean)

	get renderOrder(): number

	set renderOrder(r: number)
}

export interface IPlayable {
	get playable(): boolean
	// play(): void
	// pause(): void
	// stop(): void
	updateCurrentTime(time: number): void
}

// export interface IStylable {
// 	// getStyle(index?: string | number): any
// 	setStyle(style: any, indexList?: (number | string)[]): void
// }

export type Group = {
	startIndex: number
	count: number
	id: string
}

export type PlayStatus = 'running' | 'stopped' | 'paused'
