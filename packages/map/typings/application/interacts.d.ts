import GMap from './index';
type IProps = {
    map: GMap;
};
declare class Interacts {
    private map;
    private mouseCoord;
    private mouseDownCoord;
    private dragging;
    private firstClickTime;
    private clickTimer;
    private clickDelay;
    constructor(props: IProps);
    private calcCoord;
    private onMouseDown;
    private onMouseMove;
    private onMouseUp;
    dispose(): void;
}
export default Interacts;
