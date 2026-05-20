declare module '*.vue' {
	import { DefineComponent } from 'vue'
	const component: DefineComponent<object, object, unknown>
	export default component
}

declare module '@webgpu-gmap/map' {
	const mod: any
	export default mod
}
