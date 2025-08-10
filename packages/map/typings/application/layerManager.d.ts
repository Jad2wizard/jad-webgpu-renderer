import { IDataLayer } from './dataLayers/layer';
import GMap from '.';
import { Scene } from '@gmap/renderer';
import ScatterLayer, { IProps as ScatterLayerProps } from './dataLayers/scatterLayer';
/** 支持的图层类型 */
export type LayerType = 'scatter';
/** 图层类型与对应类的映射 */
export type LayerClass = {
    scatter: ScatterLayer;
};
/** 图层类型与对应属性的映射 */
export type LayerProps = {
    scatter: ScatterLayerProps;
};
declare class LayerManager {
    private _layers;
    private _gmap;
    private _scene;
    constructor(gmap: GMap);
    get scene(): Scene;
    get gmap(): GMap;
    getLayer(lid: string): IDataLayer;
    getAllLayers(): IDataLayer[];
    createLayer<T extends LayerType>(layerId: string, layerType: T, layerProps: LayerProps[T]): LayerClass[T];
    removeLayer(layerId: string): void;
    updateCurrentTime(): void;
    dispose(): void;
    private getLayersSortedByLevel;
}
export default LayerManager;
