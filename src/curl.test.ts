import { describe, expect, it } from 'vitest';
import {
    bezierPoint,
    computeFold,
    detectCorner,
    easeOutCirc,
    oppositeAnchor,
    shouldCompleteTurn,
    travelProgress,
} from './curl';

describe('curl geometry', () => {
    it('activates corners in 100px zones like turn.js cornerSize', () => {
        expect(detectCorner(10, 10, 400, 500)).toBe('tl');
        expect(detectCorner(390, 10, 400, 500)).toBe('tr');
        expect(detectCorner(10, 490, 400, 500)).toBe('bl');
        expect(detectCorner(390, 490, 400, 500)).toBe('br');
        expect(detectCorner(200, 250, 400, 500)).toBeNull();
        expect(detectCorner(-5, 10, 400, 500)).toBeNull();
        expect(detectCorner(390, 10, 400, 500, 100, ['br'])).toBeNull();
    });

    it('has no fold while the pointer sits on the corner', () => {
        expect(computeFold(400, 500, 'br', 400, 500)).toBeNull();
        expect(computeFold(400.5, 499.5, 'br', 400, 500)).toBeNull();
    });

    it('cuts a growing triangle as the pointer travels', () => {
        const small = computeFold(350, 490, 'br', 400, 500);
        const big = computeFold(100, 480, 'br', 400, 500);
        expect(small).not.toBeNull();
        expect(big).not.toBeNull();
        expect(big!.progress).toBeGreaterThan(small!.progress);
        expect(small!.progress).toBeGreaterThan(0);
        expect(small!.shadow).toBeGreaterThan(0);
        // flap apex tracks the pointer, content stays readable (no mirror)
        expect(big!.flapClip).toContain('100px 480px');
        expect(big!.frontClip.startsWith('polygon(')).toBe(true);
        // full travel completes the fold
        expect(computeFold(-400, 500, 'br', 400, 500)!.progress).toBe(1);
    });

    it('keeps the flap inside the page box on every corner', () => {
        const w = 400;
        const h = 500;
        for (const [corner, p] of [
            ['br', { x: 120, y: 460 }],
            ['tr', { x: 150, y: 40 }],
            ['bl', { x: 90, y: 430 }],
            ['tl', { x: 110, y: 60 }],
        ] as const) {
            const fold = computeFold(p.x, p.y, corner, w, h);
            expect(fold).not.toBeNull();
            // apex first, then the two fold-line intersections
            expect(fold!.flapClip).toContain(`${p.x}px ${p.y}px`);
            expect(fold!.frontClip.startsWith('polygon(')).toBe(true);
        }
    });

    it('travels 0 at grab, 1 at opposite anchor', () => {
        expect(travelProgress(400, 'br', 400)).toBe(0);
        const o = oppositeAnchor('br', 400, 500);
        expect(travelProgress(o.x, 'br', 400)).toBe(1);
    });

    it('releases past threshold or on flick', () => {
        expect(shouldCompleteTurn(0.5, 1000, 200)).toBe(true);
        expect(shouldCompleteTurn(0.05, 100, 60)).toBe(true);
        expect(shouldCompleteTurn(0.05, 1000, 10)).toBe(false);
    });

    it('eases and interpolates beziers', () => {
        expect(easeOutCirc(0)).toBe(0);
        expect(easeOutCirc(1)).toBeCloseTo(1);
        const p = bezierPoint(
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 10, y: 10 },
            0.5
        );
        expect(p.x).toBeCloseTo(5);
        expect(p.y).toBeCloseTo(5);
    });
});
