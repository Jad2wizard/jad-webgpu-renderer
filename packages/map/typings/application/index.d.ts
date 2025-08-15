import EventEmitter from 'eventemitter3';
import { TileLayer } from './tile';
import Renderer from './renderer';
import View from './view';
import { Extent } from '../types';
import { LayerType, LayerProps } from '../application/layerManager';
import '../application/dataLayers/scatterLayer';
type IProps = {
    container: HTMLDivElement;
    tileLayer: TileLayer;
    center?: {
        lon: number;
        lat: number;
    };
    extent?: Extent;
};
declare class GMap extends EventEmitter {
    private view;
    private tileMap;
    private renderer;
    private currentTime;
    private interacts;
    private _layerManager;
    private container;
    private extent;
    private active;
    constructor(props: IProps);
    getView(): View;
    getRenderer(): Renderer;
    getCurrentTime(): number;
    setCurentTime(time: number): void;
    getContainer(): HTMLDivElement;
    addLayer<T extends LayerType>(layerId: string, layerType: T, layerProps: LayerProps[T]): import("../application/layerManager").LayerClass[T];
    removeLayer(layerId: string): void;
    private initTileMap;
    private initView;
    private animate;
    dispose(): void;
}
export default GMap;
