import { TypedArray } from '@renderer/types';
import { WebGPUBuffer } from '@renderer/backend/WebGPUBuffer';
import { WebGPUBackend } from '@renderer/backend';
import { VariableDefinition } from 'webgpu-utils';
export type IProps = {
    id: string;
    name: string;
    def?: VariableDefinition;
    value?: TypedArray;
    buffer?: WebGPUBuffer;
    byteLength?: number;
};
/**
 * shader中 storage 变量是动态数组，没有确定的长度，所以webgpu-utils 无法为 storage 创建 typedArray，
 * 需要我们自己设置typedArray。而且 storage buffer的大小是可变的
 */
declare class Storage {
    protected _id: string;
    protected _name: string;
    protected _value: TypedArray;
    protected _buffer: WebGPUBuffer | null;
    protected _needsUpdate: boolean;
    protected _def?: VariableDefinition;
    constructor(props: IProps);
    get id(): string;
    get name(): string;
    get value(): TypedArray;
    get def(): VariableDefinition | undefined;
    set def(v: VariableDefinition | undefined);
    get binding(): number;
    get group(): number;
    get size(): number;
    get buffer(): WebGPUBuffer | null;
    get needsUpdate(): boolean;
    set needsUpdate(v: boolean);
    updateValue(value: TypedArray): void;
    updateBuffer(backend: WebGPUBackend): boolean;
    dispose(): void;
    /**
     * 克隆当前 Storage 实例
     * @param id 新实例的 id，如果不提供则使用原实例的 id
     * @param name 新实例的 name，如果不提供则使用原实例的 name
     * @param def 新实例的 def，如果不提供则使用原实例的 def
     * @returns 新的 Storage 实例
     */
    shallowClone(id: string, name: string, def?: VariableDefinition): Storage;
}
export default Storage;
