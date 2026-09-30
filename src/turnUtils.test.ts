import { describe, expect, it } from 'vitest';
import { nextPage, pageRange, prevPage, viewForPage } from './turnUtils';

describe('turnUtils (ported from turn.js)', () => {
    it('computes double views like turn.js _view', () => {
        // 4 pages, double
        expect(viewForPage(1, 4, 'double')).toEqual([0, 1]);
        expect(viewForPage(2, 4, 'double')).toEqual([2, 3]);
        expect(viewForPage(3, 4, 'double')).toEqual([2, 3]);
        expect(viewForPage(4, 4, 'double')).toEqual([4, 0]);
    });

    it('computes single views', () => {
        expect(viewForPage(2, 4, 'single')).toEqual([2]);
    });

    it('next / previous follow turn.js semantics', () => {
        expect(nextPage(1, 4, 'double')).toBe(2);
        expect(nextPage(2, 4, 'double')).toBe(4);
        expect(nextPage(4, 4, 'double')).toBe(4); // already at end
        expect(prevPage(4, 4, 'double')).toBe(3);
        expect(prevPage(1, 4, 'double')).toBe(1); // already at start
        expect(nextPage(1, 2, 'single')).toBe(2);
    });

    it('computes a memory range window', () => {
        const [a, b] = pageRange(1, 10, 'double');
        expect(a).toBe(1);
        expect(b).toBeGreaterThan(1);
    });
});
