/// <reference types="dist" />
import Attribute from './attribute';
import Index from './indices';
import { Group } from '@renderer/types';
import { WebGPUBuffer } from '@renderer/backend/WebGPUBuffer';
import { WebGPUBackend } from '@renderer/backend';
declare class Geometry {
    private _id;
    private _group?;
    private attributes;
    private _vertexCount;
    private _instanceCount;
    index: Index | null;
    constructor(id: string);
    get id(): string;
    set group(value: Group | undefined);
    get group(): Group | undefined;
    set vertexCount(v: number);
    get vertexCount(): number;
    set instanceCount(i: number);
    get instanceCount(): number;
    getAttribute(name: string): Attribute | null;
    setAttribute(attribtueName: string, attribute: Attribute): void;
    removeAttribute(attribtueName: string): void;
    setIndex(arr: Uint32Array | undefined): void;
    getIndex(): import("@renderer/types").TypedArray | null;
    getIndexBuffer(backend: WebGPUBackend): WebGPUBuffer | null;
    getVertexBufferLayout(): GPUVertexBufferLayout[];
    getAttributes(): Attribute[];
    getBuffers(backend: WebGPUBackend): WebGPUBuffer[];
    updateVertexBuffers(backend: WebGPUBackend): WebGPUBuffer[];
    dispose(): void;
}
export default Geometry;
