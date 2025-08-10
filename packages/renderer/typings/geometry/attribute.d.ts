/// <reference types="dist" />
import { TypedArray } from '../types';
import { WebGPUBuffer } from '../backend/WebGPUBuffer';
import { WebGPUBackend } from '../backend';
type Options = {
    shaderLocation?: number;
    stepMode?: GPUVertexStepMode;
    capacity?: number;
};
declare class Attribute {
    private _name;
    private _array;
    private _itemSize;
    private _buffer;
    private _shaderLocation?;
    private _stepMode;
    private _needsUpdate;
    constructor(name: string, data: TypedArray, itemSize: number, options?: Options);
    get needsUpdate(): boolean;
    set needsUpdate(v: boolean);
    get name(): string;
    set name(v: string);
    get shaderLocation(): number | undefined;
    set shaderLocation(l: number | undefined);
    get stepMode(): GPUVertexStepMode;
    get array(): TypedArray;
    set array(data: TypedArray);
    get itemSize(): number;
    set itemSize(v: number);
    get buffer(): WebGPUBuffer | null;
    updateBuffer(backend: WebGPUBackend): boolean;
    getFormat(): GPUVertexFormat;
    reallocate(size: number): void;
    dispose(): void;
}
export default Attribute;
