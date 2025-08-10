/// <reference types="dist" />
import Model from '../Model';
import { Color, Blending, IPlayable } from '../types';
import Renderer from '../Renderer';
import { Camera } from '../camera/camera';
type ColorList = [Color, Color, Color, Color, Color];
type OffsetList = [number, number, number, number, number];
type IProps = {
    id: string;
    points: Float32Array;
    startTime?: Float32Array;
    total?: number;
    style?: {
        colorList?: ColorList;
        colorOffsets?: OffsetList;
        blur?: number;
        radius?: number;
        blending?: Blending;
    };
};
declare class Heatmap extends Model implements IPlayable {
    private points;
    private startTime?;
    private heatPointsModel?;
    private maxHeatValueModel?;
    private _total;
    private _cachedColorOffsets;
    private lastResolution;
    /**
     * points 为热力点的二维坐标 e.g [x0, y0, x1, y1,....]
     * startTime 为热力点的播放时间，可选
     * total 为预设的热力点数量，可以大于 points.length / 2
     * style.colorList 为将浮点数的热力值插值为 rgb 颜色时的插值颜色数组
     * style.colorOffsets 为颜色插值时各个颜色对应的区间取值为1到0，降序
     * style.radius 为热力点的像素半径
     * style.blur (0, 1]，maxHeatValue 对像素热力值做归一化时需先乘以该值
     * @param props
     */
    constructor(props: IProps);
    get style(): {
        colorList: ColorList;
        colorOffsets: OffsetList;
        blur: number;
        radius: number;
        blending: Blending;
    };
    get total(): number;
    get playable(): boolean;
    /**
     * Validates constructor props
     */
    private validateProps;
    /**
     * heatValTex 作为 heatPointsModel 的输出纹理以及 maxHeatValueModel 的输入纹理在 R 通道记录了像素热力值
     * size 为像素的宽高
     * @param renderer
     */
    private createHeatValueTexture;
    /**
     * maxValTex 作为 maxHeatValueModel 输出纹理，记录了所有像素的最大热力值
     * size 为1x1
     * @param renderer
     */
    private createMaxHeatValueTexture;
    private createHeatPointsModel;
    private createMaxHeatValueModel;
    /**
     * Checks if resolution has changed
     */
    private hasResolutionChanged;
    private checkCreateHeatValueTexture;
    private reallocate;
    get colorOffsets(): Float32Array;
    /**
     * Invalidates cached color offsets
     */
    private invalidateColorCache;
    setTotal(t: number): void;
    prevRender(renderer: Renderer, encoder: GPUCommandEncoder, camera: Camera): void;
    updateCurrentTime(time: number): void;
    setStyle(style: Exclude<IProps['style'], undefined>): void;
    /**
     * 往当前热力图中追加热力点数据
     * @param points 热力点的二维坐标数组
     * @param startTime
     */
    appendHeatPoints(points: Float32Array, startTime?: Float32Array): void;
    dispose(): void;
}
export default Heatmap;
