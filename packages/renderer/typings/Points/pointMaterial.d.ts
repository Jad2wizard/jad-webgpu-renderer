import Material from '../material/material';
import { Blending, Color } from '../types';
import RadiusStorage from './radiusStorage';
export type IProps = {
    modelName: string;
    hasColorAttribute: boolean;
    total: number;
    blending: Blending;
    color: Color;
    radius: number;
    radiusStorage: RadiusStorage;
    hasTime?: boolean;
};
declare class PointMaterial extends Material {
    hasColorAttribute: boolean;
    hasRadiusAttribute: boolean;
    hasTimeAttribute: boolean;
    constructor(props: IProps);
    updateShaderCode(hasColor: boolean, hasRadius: boolean, hasTime: boolean): void;
    updateUniform(uniformName: string, value: any): void;
}
export default PointMaterial;
