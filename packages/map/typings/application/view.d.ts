import { Vector2 } from 'three';
import { Extent } from '@/types';
import TileMap from './tile';
type IProps = {
    tileMap: TileMap;
    width: number;
    height: number;
    extent: Extent;
    center?: {
        lon: number;
        lat: number;
    };
    controlCanvas: HTMLCanvasElement;
};
declare class View {
    private tileMap;
    private width;
    private height;
    private offset;
    private proj;
    private raycaster;
    private _camera;
    private plane;
    private controls;
    constructor(props: IProps);
    get resolution(): number | undefined;
    get camera(): PerspectiveCamera;
    animate(): void;
    lonlat2World(lon: number, lat: number): Vector2;
    world2Lonlat(coord: Vector2): [number, number];
    screen2World(left: number, top: number): Vector2;
    world2Screen(coord: Vector2): Vector2;
    lonlat2Screen(lon: number, lat: number): Vector2;
    screen2Lonlat(left: number, top: number): [number, number];
    private initCamera;
    private calcFov;
    private onViewChange;
    private onKeyDown;
    private onKeyUp;
    private bindEvents;
    private unbindEvents;
    dispose(): void;
}
export default View;
