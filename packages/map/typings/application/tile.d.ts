import View from 'ol/View';
import OLTileLayer from 'ol/layer/Tile';
import { Extent } from '@/types';
import WMTS from 'ol/source/WMTS';
import XYZ from 'ol/source/XYZ';
import OSM from 'ol/source/OSM';
export type TileLayer = OLTileLayer<WMTS> | OLTileLayer<XYZ> | OLTileLayer<OSM>;
type IProps = {
    container: HTMLElement;
    tileLayer: TileLayer;
    center?: {
        lon: number;
        lat: number;
    };
};
declare class TileMap {
    private olMap;
    private tileLayer;
    constructor(props: IProps);
    getView(): View;
    getCenter(): import("ol/coordinate").Coordinate | null;
    getResolution(): number | undefined;
    getResolutionInDegree(): number | null;
    updateView(params: {
        center?: {
            lon: number;
            lat: number;
        };
        zoom?: number;
    }): void;
    calcZoomFromExtent(extent: Extent, width: number, height: number): number | undefined;
}
export default TileMap;
