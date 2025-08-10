/// <reference types="dist" />
import { Camera } from './camera/camera';
import Renderer from './Renderer';
import Geometry from './geometry/geometry';
import Material from './material/material';
import { IRenderable, TypedArray } from './types';
type Options = {};
declare class Model implements IRenderable {
    protected _id: string;
    protected _geometry: Geometry;
    protected _material: Material;
    protected _visible: boolean;
    protected _renderOrder: number;
    protected _style: any;
    protected textures: Record<string, GPUTexture>;
    constructor(name: string, geometry: Geometry, material: Material, opts?: Options);
    get id(): string;
    set id(v: string);
    get geometry(): Geometry;
    set geometry(geo: Geometry);
    get material(): Material;
    set material(mat: Material);
    get visible(): boolean;
    set visible(v: boolean);
    get renderOrder(): number;
    set renderOrder(r: number);
    updateTexture(tn: string, texture: GPUTexture): void;
    prevRender(renderer: Renderer, encoder: GPUCommandEncoder, camera: Camera): void;
    getAttribute(k: string): TypedArray | null;
    updateAttribute(k: string, value: TypedArray): void;
    render(renderer: Renderer, pass: GPURenderPassEncoder, camera: Camera, textures?: Record<string, GPUTexture>): void;
    dispose(): void;
}
export default Model;
