/**
 * Corner-drag page-curl geometry for react-turnjs.
 *
 * The fold model (grab a corner, the paper reflects rigidly across the
 * fold line, shadows peak mid-turn, programmatic turns travel a bezier
 * to the far corner) follows the approach popularized by turn.js.
 * This is a clean-room implementation written for React — no turn.js
 * source is used or bundled.
 */

export type CurlCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface Point {
    x: number;
    y: number;
}

export interface FoldResult {
    /** Turning-page box corners kept visible, page coordinates. */
    front: Point[];
    /** Folded flap triangle [P, F1, F2], page coordinates. */
    flap: [Point, Point, Point];
    /** CSS clip-path for the turning (front) page: box minus the folded triangle. */
    frontClip: string;
    /**
     * CSS clip-path for the revealed flap: the folded triangle [P, F1, F2].
     * The flap shows the target page static (readable, like a real page
     * landing) with a shading gradient faking the curl curvature.
     */
    flapClip: string;
    /** 0..1 — how far the page has turned. Drives release + shadows. */
    progress: number;
    /** 0..1 — shadow intensity, peaks mid-turn. */
    shadow: number;
}

const PI = Math.PI;

/** Release physics tuning. */
export const RELEASE_PROGRESS = 0.28;
export const FLICK_MS = 250;
export const FLICK_PX = 24;

export function cornerAnchor(corner: CurlCorner, w: number, h: number): Point {
    switch (corner) {
        case 'tl':
            return { x: 0, y: 0 };
        case 'tr':
            return { x: w, y: 0 };
        case 'bl':
            return { x: 0, y: h };
        case 'br':
            return { x: w, y: h };
    }
}

/** Diagonal target for a completing turn, extended past the page edge. */
export function oppositeAnchor(corner: CurlCorner, w: number, h: number): Point {
    switch (corner) {
        case 'tl':
            return { x: w * 2, y: 0 };
        case 'tr':
            return { x: -w, y: 0 };
        case 'bl':
            return { x: w * 2, y: h };
        case 'br':
            return { x: -w, y: h };
    }
}

/**
 * Corner activation: the pointer must be inside a `size`px square at a
 * page corner (same rule as turn.js `cornerSize: 100`).
 */
export function detectCorner(
    x: number,
    y: number,
    w: number,
    h: number,
    size = 100,
    allowed?: readonly CurlCorner[]
): CurlCorner | null {
    if (w <= 0 || h <= 0) return null;
    if (x < 0 || y < 0 || x > w || y > h) return null;
    let c = '';
    if (y < size) c += 't';
    else if (y >= h - size) c += 'b';
    else return null;
    if (x <= size) c += 'l';
    else if (x >= w - size) c += 'r';
    else return null;
    const corner = c as CurlCorner;
    if (allowed && !allowed.includes(corner)) return null;
    return corner;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Cubic bezier (turn.js animates turns along bezier(p1, p1, p4, p4)). */
export function bezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const u = 1 - t;
    return {
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
}

/** Ease-out-circular, the turn.js `animatef` default easing. */
export function easeOutCirc(t: number): number {
    const c = clamp(t, 0, 1) - 1;
    return Math.sqrt(1 - c * c);
}

/**
 * Horizontal travel of the drag point away from the grabbed corner,
 * normalized by page width. 0 at grab, >= 1 at/past the opposite edge.
 */
export function travelProgress(x: number, corner: CurlCorner, w: number): number {
    if (w <= 0) return 0;
    const anchor = cornerAnchor(corner, w, 0);
    const travel = corner === 'tl' || corner === 'bl' ? x - anchor.x : anchor.x - x;
    return clamp(travel / w, 0, 1);
}

export function shouldCompleteTurn(progress: number, elapsedMs: number, movedPx: number): boolean {
    if (progress >= RELEASE_PROGRESS) return true;
    // quick flick, like turn.js `< 200ms` release rule
    return elapsedMs < FLICK_MS && movedPx > FLICK_PX && progress > 0.02;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Intersections of the parametric line P + t·D with the page box. */
function lineBoxIntersections(
    px: number,
    py: number,
    dx: number,
    dy: number,
    w: number,
    h: number
): Point[] {
    const pts: Point[] = [];
    const push = (x: number, y: number) => {
        if (x < -0.01 || x > w + 0.01 || y < -0.01 || y > h + 0.01) return;
        const cx = clamp(x, 0, w);
        const cy = clamp(y, 0, h);
        if (!pts.some((p) => Math.hypot(p.x - cx, p.y - cy) < 0.5)) pts.push({ x: cx, y: cy });
    };
    if (Math.abs(dx) > 1e-9) {
        push(px + ((0 - px) / dx) * dx, py + ((0 - px) / dx) * dy);
        push(px + ((w - px) / dx) * dx, py + ((w - px) / dx) * dy);
    }
    if (Math.abs(dy) > 1e-9) {
        push(px + ((0 - py) / dy) * dx, py + ((0 - py) / dy) * dy);
        push(px + ((h - py) / dy) * dx, py + ((h - py) / dy) * dy);
    }
    return pts;
}

/** CSS polygon() clip-path from points (same coordinate space as the layer). */
export function toPolygonClip(points: readonly Point[]): string {
    const str = (p: Point) => `${round2(p.x)}px ${round2(p.y)}px`;
    return `polygon(${points.map(str).join(', ')})`;
}

/**
 * Rigid page fold for a drag point in page coordinates.
 *
 * The grabbed corner C tracks the pointer P exactly: the paper reflects
 * across their perpendicular bisector (the fold line). The front keeps
 * the box minus the folded triangle; the back shows the target page
 * mirrored across the same line. Returns null when the pointer is still
 * on the corner (no visible fold yet).
 */
export function computeFold(
    px: number,
    py: number,
    corner: CurlCorner,
    w: number,
    h: number
): FoldResult | null {
    if (w <= 0 || h <= 0) return null;
    const x = clamp(px, -w, w * 2);
    const y = clamp(py, -h, h * 2);
    const c = cornerAnchor(corner, w, h);
    const dx = x - c.x;
    const dy = y - c.y;
    const len = Math.hypot(dx, dy);
    if (len < 2) return null;

    const ux = dx / len;
    const uy = dy / len;
    const mx = (c.x + x) / 2;
    const my = (c.y + y) / 2;

    // fold line: through M, direction perpendicular to CP
    const pts = lineBoxIntersections(mx, my, -uy, ux, w, h);
    if (pts.length < 2) return null;
    const [f1, f2] = pts;

    // front = box corners on the far side of the fold line + intersections
    const side = (p: Point) => (p.x - mx) * ux + (p.y - my) * uy;
    const box: Point[] = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
    ];
    const poly = [...box.filter((p) => side(p) >= -0.01), f1, f2];
    const ccx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
    const ccy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
    poly.sort((a, b) => Math.atan2(a.y - ccy, a.x - ccx) - Math.atan2(b.y - ccy, b.x - ccx));
    const front: Point[] = poly.map((p) => ({ x: round2(p.x), y: round2(p.y) }));

    const str = (p: Point) => `${round2(p.x)}px ${round2(p.y)}px`;
    const frontClip = `polygon(${poly.map(str).join(', ')})`;
    // flap in page space: pointer apex + fold-line intersections
    const flap: [Point, Point, Point] = [
        { x, y },
        { x: round2(f1.x), y: round2(f1.y) },
        { x: round2(f2.x), y: round2(f2.y) },
    ];
    const flapClip = `polygon(${flap.map(str).join(', ')})`;

    const progress = travelProgress(x, corner, w);
    return { front, flap, frontClip, flapClip, progress, shadow: Math.sin(progress * PI) };
}
