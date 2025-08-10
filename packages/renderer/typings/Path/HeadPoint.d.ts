import Model from '../Model';
import { Path, Style } from './Path';
export declare class HeadPoint extends Model {
    constructor(pathModel: Path, style: Required<Style>);
    dispose(): void;
}
