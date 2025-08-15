import { Color } from '@renderer/types';
import { TypedArray } from 'three';
export declare const genId: () => string;
export declare const minUniformBufferOffsetAlignment = 256;
export declare const minStorageBufferOffsetAlignment = 256;
export declare const indexFormat = "uint32";
export declare const binarySearch: (arr: TypedArray | Array<number | string>, target: number | string, compare?: 'less' | 'more') => number;
export declare const convertUniformColor: <T extends Color | undefined>(c: T) => T;
export declare const deepMerge: <T>(...obj: Partial<T>[]) => T;
/**
 * 将四个 uint8 数值打包成一个 uint32 数值
 * 使用小端字节序，即 [a, b, c, d] => (d << 24) | (c << 16) | (b << 8) | a
 *  如果 data 为 color 存放[r, g, b, a] 四个通道的分量，那么通道 r 的值位于 uint32的最低四个字节中
 * @example packUint8ToUint32([255, 0, 0, 0]) => 4278190080
 * @param {number[]} data 一个长度为四的 uint8 数组
 * @returns {number} 一个 uint32数值
 */
export declare const packUint8ToUint32: (data: [number, number, number, number]) => number;
/**
 * 将一个 uint32 数值分解成四个 uint8 数值
 * 使用小端字节序，即 num => [(num >> 0) & 255, (num >> 8) & 255, (num >> 16) & 255, (num >> 24) & 255]
 * @example unpackUint32ToUint8(4278190080) => [255, 0, 0, 0]
 * @param {number} num 一个 uint32数值
 * @returns {[number, number, number, number]} 一个长度为四的 uint8 数组
 */
export declare const unpackUint32ToUint8: (num: number) => [number, number, number, number];
/**
 * 将 16 位半精度浮动数（IEEE 754 half-precision float）转换为 32 位单精度浮动数（float32）
 *
 * 16 位半精度浮动数采用以下结构：
 * - 1 位符号位
 * - 5 位指数部分（exponent）
 * - 10 位尾数部分（mantissa）
 *
 * @param {number} half - 一个 16 位整数，表示一个半精度浮动数。此数应符合 IEEE 754 半精度浮动数格式。
 * @returns {number} 返回转换后的 32 位单精度浮动数（float32）。
 */
export declare function halfToFloat(half: number): number;
/**
 * 将 Uint16Array 中的每个 16 位半精度浮动数转换为 32 位单精度浮动数（float32）
 *
 * @param {Uint16Array} data - 一个包含多个 16 位半精度浮动数的数组（Uint16Array）。
 * @returns {Float32Array} 返回一个包含转换后的 32 位单精度浮动数的数组（Float32Array）。
 */
export declare function convertHalfToFloatArray(data: Uint16Array): Float32Array;
/**
 * 将前端常见的颜色格式转换为标准化的 RGBA 颜色值
 * 每个分量的取值范围为 0 到 1
 *
 * @param color - 支持的颜色格式：
 *   - 十六进制字符串: "#ff0000", "#f00", "ff0000", "f00"
 *   - RGB/RGBA 字符串: "rgb(255, 0, 0)", "rgba(255, 0, 0, 1)"
 *   - 数组格式: [255, 0, 0], [255, 0, 0, 255], [1, 0, 0, 1]
 * @returns 标准化的 RGBA 颜色值 [r, g, b, a]，每个分量范围为 0-1
 */
export declare function normalizeColor(color: string | number[]): Color;
