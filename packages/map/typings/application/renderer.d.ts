import { Camera, Scene } from '@gmap/renderer';
type IProps = {
    container: HTMLElement;
    antialias: boolean;
};
declare class Renderer {
    private _renderer;
    private _canvas;
    private _antialias;
    constructor(props: IProps);
    init(): Promise<void>;
    get canvas(): HTMLCanvasElement;
    render(scene: Scene, camera: Camera): void;
    resize(): void;
    dispose(parentElement: HTMLElement): void;
}
export default Renderer;
