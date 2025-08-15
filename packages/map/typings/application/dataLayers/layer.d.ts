import { Scene } from '@gmap/renderer';
import { Extent } from '../../types';
import GMap from '..';
export type LabelFields = {
    labelFields?: {
        field: number;
        title: string[];
    };
};
export type StyleParams = Record<string, any>;
export type Data = (number | string)[][];
export interface IDataLayer {
    getId(): string;
    getSelected(): boolean;
    getVisible(): boolean;
    getLevel(): number;
    updateData(data: Data, fields: LabelFields, style?: StyleParams): Promise<boolean>;
    updateStyle(style: StyleParams): Promise<boolean>;
    setSelected(setSelected: boolean): Promise<boolean>;
    setVisible(setVisible: boolean): Promise<boolean>;
    setLevel(setLevel: number): Promise<boolean>;
    onTimeUpdate(time: number): void;
    clearAll(): void;
    dispose(): void;
}
export type IBaseLayerProps = {
    id: string;
    level: number;
    scene: Scene;
    map: GMap;
};
export declare class BaseLayer {
    protected id: string;
    protected selected: boolean;
    protected visible: boolean;
    protected level: number;
    protected extent?: Extent;
    protected scene: Scene;
    protected startTime: number;
    constructor(props: IBaseLayerProps);
    getExtent(): Extent | null;
    getId(): string;
    getSelected(): boolean;
    getVisible(): boolean;
    getLevel(): number;
}
