interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TrackEvent {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

type ColorFn = (r: number, g: number, b: number) => boolean;

export {
    Rect,
    TrackEvent,
    ColorFn
}