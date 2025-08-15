import { TypedArray } from '@renderer/types';
import { WebGPUBuffer } from '@renderer/backend/WebGPUBuffer';
import { WebGPUBackend } from '@renderer/backend';
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
