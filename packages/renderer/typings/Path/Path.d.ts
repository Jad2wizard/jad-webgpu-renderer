import PathMaterial from '../material/pathMaterial';
import Model from '../Model';
import { Blending, Color } from '../types';
export declare const defaultStyle: {
    color: Color;
    lineWidth: number;
    unplayedColor: Color;
    unplayedLineWidth: number;
    tailDuration: number;
    headPointVisible: boolean;
    headPointSize: number;
    drawLine: boolean;
};
export type Style = {
    color?: Color;
    lineWidth?: number;
    unplayedColor?: Color;
    unplayedLineWidth?: number;
    blending?: Blending;
    tailDuration?: number;
    headPointVisible?: boolean;
    headPointColor?: Color;
    headPointSize?: number;
    drawLine?: boolean;
};
export type IProps = {
    pathId: string;
    position: Float32Array;
    startTime?: Float32Array;
    style?: Style;
};
export declare class Path extends Model {
    private style;
    constructor(props: IProps);
    get material(): PathMaterial;
    get positions(): Float32Array;
    get startTimes(): Float32Array | null;
    get drawLine(): boolean;
    changeDrawLine(drawLine: boolean, position: Float32Array): void;
    getData(): {
        positions: import("../types").TypedArray | null;
        startTimes: import("../types").TypedArray | null;
        style: Style;
    };
    private static extendLineToMesh;
}
