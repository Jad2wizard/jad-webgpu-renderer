import PointMaterial from './pointMaterial';
import Model from '../Model';
import { Blending, Color, IPlayable } from '../types';
type IProps = {
    id: string;
    position: Float32Array;
    radius?: Uint8Array;
    color?: Uint8Array;
    startTime?: Float32Array;
    total?: number;
    style?: {
        radius?: number;
        color?: Color;
        blending?: Blending;
    };
};
declare class Points extends Model implements IPlayable {
    private _playable;
    private _total;
    /**
     * position 为散点坐标数组长度为2 * total，radius 为散点大小数组长度为2 * total，color 为散点颜色数组长度为4 * total（color的四个分量取值范围为0到1）
     * radius, startTime 和 color可选，用于给每个散点单独设置大小, 时间和颜色，如果设置了 radius 和 color，renderer 会忽略 style.color|radius
     * material可选，material.radius 设置模型中所有散点的大小默认值8，material.color 设置模型中所有散点的颜色默认值[1, 0, 0, 1]
     * @param props
     */
    constructor(props: IProps);
    get playable(): boolean;
    get material(): PointMaterial;
    get total(): number;
    private getRadiusStorage;
    batchUpdateColor(params: [number, Color][]): void;
    batchUpdateRadius(params: [number, number][]): void;
    /**
     * 设置模型的样式
     * @param style
     * @param pointIndices 可选，表示要更新的散点的索引，如果不传递，更新所有散点的样式
     */
    setStyle(style: Exclude<IProps['style'], undefined>, pointIndices?: number[]): void;
    getStyle(index?: number): any;
    setTotal(count: number): void;
    private updateMaterial;
    private initAttributes;
    private reallocate;
    appendPoints({ position, startTime, color: colorData, radius: radiusData, }: Pick<IProps, 'position' | 'startTime' | 'color' | 'radius'>): void;
    updateCurrentTime(time: number): void;
}
export default Points;
