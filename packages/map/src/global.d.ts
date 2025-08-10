declare module '*.css'
declare module '*.glsl'
declare module '*.png'
declare module '*.less' {
	const content: any
	export default content
}

//T extends any 永远返回 true，作用是触发联合类型的分布式特性。ts 中当条件类型作用域联合类型时，会自动分布到联合类型的每个成员上。
// 后面的 omit<T, K>会作用在联合类型的每个成员上，然后取执行结果的联合类型返回
declare type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

declare type PartialOptional<T, K extends keyof T> = DistributiveOmit<T, K> & Partial<Pick<T, K>>

declare type DeepRequired<T> = T extends object ? {[P in keyof T]-?: DeepRequired<T[P]>} : T
