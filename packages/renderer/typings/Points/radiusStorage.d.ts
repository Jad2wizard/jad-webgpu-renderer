import Storage from '../material/storage';
type IProps = {
    id: string;
    data?: Uint8Array;
    total?: number;
};
/**
 *  因为 radius 数值类型为 uint8，而 webgpu 不支持 u8类型的 vertex buffer
 *  故将散点的半径attribute 数据存放在 storage 中，并将四个相邻散点的 radius 合并到一个 uint32中
 */
declare class RadiusStorage extends Storage {
    private _hasRealData;
    constructor(props: IProps);
    /**
     * 确保数据大小是 4 的倍数
     */
    private static ensureAligned;
    get hasData(): boolean;
    getPointRadius(index: number): number | undefined;
    updatePointsRadius(radius: number | number[], defaultRadius: number, total: number, pointIndices: number[]): void;
    reallocate(size: number): void;
    appendData(radiusArray: Uint8Array, appendLen: number, start: number): void;
}
export default RadiusStorage;
