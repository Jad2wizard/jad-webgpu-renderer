/// <reference types="dist" />
import Model from '../Model';
import { IRenderable } from '../types';
import Renderer from '../Renderer';
import { Camera } from '../camera/camera';
import { Path, Style, IProps as PathProps } from './Path';
export declare class Paths implements IRenderable {
    private _id;
    private _style;
    private _pathsStyle;
    protected _visible: boolean;
    protected _renderOrder: number;
    protected pathModelList: Path[];
    protected headPointList: Model[];
    /**
     * 参数为 Path  参数数组，每个Path 参数中包括：
     * position 为轨迹点的坐标数组经纬度间隔存放
     * startTime 为轨迹上各个轨迹点的相对发生时间的毫秒级时间戳，如果设置后，轨迹默认不显示，用户通过updateTime接口更新当前时间，轨迹点时间小于当前时间的部分轨迹才会显示出来
     * style.lineWidth 为轨迹像素宽度，默认值为5，drawLine为 false 时生效
     * style.color为轨迹播放后部分的颜色，默认值为[1, 0, 0, 0.7]
     * style.drawLine 默认为 false，为 true 时轨迹宽度恒等于1，webgpu 将使用 line-strip 渲染轨迹，为 false 时使用 triangle-list 渲染轨迹
     * style.trailDuration 播放的部分轨迹在持续trailDuration时间后消失，单位为毫秒，仅当 startTime 参数存在时有效，传0值时取消拖尾效果
     * style.unplayedColor 为轨迹尚未播放 部分的颜色，默认值为[0, 0, 0, 0.05]
     * style.unplayedLineWidth 为轨迹尚未播放部分的宽度，默认值为5，drawLine为 false 时生效
     * style.headPointColor 为轨迹头部圆点颜色，默认值为所属轨迹的颜色，headPointVisible 为 true 时生效
     * style.headPointSize 为轨迹头部圆点像素大小，headPointVisible 为 t
     * style.headPointVisible 控制轨迹头是否课件
     * @param props
     * @returns
     */
    constructor(paths: PathProps[], style?: Style);
    get id(): string;
    appendPaths(paths: PathProps[]): void;
    getPathDataById(pathId: string): {
        positions: import("../types").TypedArray | null;
        startTimes: import("../types").TypedArray | null;
        style: Style;
    } | null;
    getStyle(pathId: string): {
        color: import("../types").Color;
        lineWidth: number;
        unplayedColor: import("../types").Color;
        unplayedLineWidth: number;
        blending: "max" | "none" | "min" | "normalBlending" | "additiveBlending";
        tailDuration: number;
        headPointVisible: boolean;
        headPointColor: import("../types").Color;
        headPointSize: number;
        drawLine: boolean;
    } | undefined;
    setStyle(style: Style, pathIds?: string[]): void;
    get visible(): boolean;
    set visible(v: boolean);
    get renderOrder(): number;
    set renderOrder(r: number);
    updateCurrentTime(time: number): void;
    prevRender(renderer: Renderer, encoder: GPUCommandEncoder, camera: Camera): void;
    render(renderer: Renderer, pass: GPURenderPassEncoder, camera: Camera): void;
    dispose(): void;
}
