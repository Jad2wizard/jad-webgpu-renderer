import { Object3D } from './Object3D';
import { IRenderable } from './types';
declare class Scene extends Object3D {
    private _modelList;
    constructor();
    get modelList(): IRenderable[];
    getAllModels(): IRenderable[];
    addModel(model: IRenderable): void;
    removeModel(model: IRenderable): void;
    getModel(id: string): IRenderable | null;
    dispose(): void;
}
export default Scene;
