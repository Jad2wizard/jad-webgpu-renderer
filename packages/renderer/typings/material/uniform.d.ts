import { StructuredView, VariableDefinition } from 'webgpu-utils';
import { WebGPUBuffer } from '../backend/WebGPUBuffer';
import { WebGPUBackend } from '../backend';
export type IProps = {
    id: string;
    name: string;
    def: VariableDefinition;
    value: any;
};
declare class Uniform {
    protected _id: string;
    protected _name: string;
    protected def: VariableDefinition;
    protected view: StructuredView;
    protected _value: any;
    protected _buffer: WebGPUBuffer | null;
    protected _needsUpdate: boolean;
    constructor(props: IProps);
    get id(): string;
    get name(): string;
    get value(): any;
    get binding(): number;
    get group(): number;
    get size(): number;
    get buffer(): WebGPUBuffer | null;
    get needsUpdate(): boolean;
    set needsUpdate(v: boolean);
    updateValue(value: any): void;
    updateBuffer(backend: WebGPUBackend): boolean;
    dispose(): void;
}
export default Uniform;
