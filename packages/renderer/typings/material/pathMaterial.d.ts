import Material from './material';
import { Blending, Color } from '../types';
export type IProps = {
    modelName: string;
    color: Color;
    lineWidth: number;
    unplayedColor?: Color;
    unplayedLineWidth?: number;
    blending?: Blending;
    tailDuration?: number;
    positions: Float32Array;
    startTimes?: Float32Array;
    drawLine?: boolean;
};
declare class PathMaterial extends Material {
    hasTime: boolean;
    hasTail: boolean;
    constructor(props: IProps);
    updateTime(time: number): void;
    changeStyle(style: Partial<IProps>): void;
}
export default PathMaterial;
