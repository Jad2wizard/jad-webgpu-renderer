import { IDataLayer, BaseLayer, IBaseLayerProps, Data, LabelFields, StyleParams } from './layer';
import { Color } from '@/types';
type FieldsType = LabelFields & {
    lon: number;
    lat: number;
    startTime?: number;
};
type StyleType = {
    color?: Color;
    radius?: number;
    highlight?: {
        color?: Color;
        radius?: number;
    };
};
export type IProps = {
    fields: FieldsType;
    style?: StyleType;
    getColor?: (row: (string | number)[]) => Color;
    getRadius?: (row: (string | number)[]) => number;
    total?: number;
};
declare class ScatterLayer extends BaseLayer implements IDataLayer {
    private points?;
    private fields;
    private step;
    private style;
    private getColor;
    private getRadius;
    private total?;
    private inputData;
    private map;
    constructor(props: IBaseLayerProps & IProps);
    setSelected(selected: boolean): Promise<boolean>;
    setVisible(visible: boolean): Promise<boolean>;
    setLevel(level: number): Promise<boolean>;
    updateData(data: Data): Promise<boolean>;
    appendData(data: Data): Promise<boolean>;
    updateStyle(style: StyleParams, pointIndices?: number[]): Promise<boolean>;
    onTimeUpdate(time: number): void;
    clearAll(): void;
    dispose(): void;
    private parseData;
}
export default ScatterLayer;
