import { TypedArray } from '../types';
import { WebGPUBuffer } from '../backend/WebGPUBuffer';
import { WebGPUBackend } from '../backend';
declare class Index {
    private _name;
    private _array;
    private _buffer;
    private _needsUpdate;
    constructor(name: string, data: TypedArray);
    get name(): string;
    get needsUpdate(): boolean;
    set needsUpdate(v: boolean);
    get array(): TypedArray;
    set array(value: TypedArray);
    get buffer(): WebGPUBuffer | null;
    updateBuffer(backend: WebGPUBackend): boolean;
    dispose(): void;
}
export default Index;
