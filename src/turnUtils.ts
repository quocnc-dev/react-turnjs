import type { TurnDisplay } from './types';

/**
 * Pure port of turn.js `_view` / `view` / `range` logic.
 * All pages are 1-indexed. 0 means "no page" (cover edge).
 */

export function viewForPage(page: number, totalPages: number, display: TurnDisplay): number[] {
    if (totalPages <= 0) return display === 'double' ? [0, 0] : [0];
    const p = Math.min(Math.max(Math.round(page) || 1, 1), totalPages);

    if (display === 'single') {
        return [p];
    }
    // turn.js _view: odd -> [page-1, page], even -> [page, page+1]
    const raw: [number, number] = p % 2 === 1 ? [p - 1, p] : [p, p + 1];
    return [raw[0] > 0 ? raw[0] : 0, raw[1] <= totalPages ? raw[1] : 0];
}

/** Raw turn.js `_view` (no zeroing) — used by next/previous. */
function rawView(page: number, totalPages: number, display: TurnDisplay): number[] {
    const p = Math.min(Math.max(Math.round(page) || 1, 1), Math.max(totalPages, 1));
    if (display === 'single') return [p];
    return p % 2 === 1 ? [p - 1, p] : [p, p + 1];
}

export function nextPage(page: number, totalPages: number, display: TurnDisplay): number {
    // turn.js next(): _view(page).pop() + 1 ; out-of-range page() is a no-op
    const raw = rawView(page, totalPages, display);
    const next = raw[raw.length - 1] + 1;
    if (next < 1 || next > totalPages) return clampPage(page, totalPages);
    return next;
}

export function prevPage(page: number, totalPages: number, display: TurnDisplay): number {
    // turn.js previous(): _view(page).shift() - 1 ; out-of-range page() is a no-op
    const raw = rawView(page, totalPages, display);
    const prev = raw[0] - 1;
    if (prev < 1 || prev > totalPages) return clampPage(page, totalPages);
    return prev;
}

/** Port of turn.js `range()` — window of pages to keep in memory. */
export function pageRange(
    page: number,
    totalPages: number,
    display: TurnDisplay,
    pagesInDOM = 6
): [number, number] {
    if (totalPages <= 0) return [0, 0];
    const view = viewForPage(page, totalPages, display);
    const v0 = view[0];
    const v1 = view[1] ?? view[0];

    if (v0 >= 1 && v1 <= totalPages && v1 >= 1) {
        const remaining = Math.floor((pagesInDOM - 2) / 2);
        let left: number;
        let right: number;
        if (totalPages - v1 > v0) {
            left = Math.min(v0 - 1, remaining);
            right = 2 * remaining - left;
        } else {
            right = Math.min(totalPages - v1, remaining);
            left = 2 * remaining - right;
        }
        return [Math.max(1, v0 - left), Math.min(totalPages, v1 + right)];
    }
    return [1, Math.min(totalPages, pagesInDOM)];
}

export function clampPage(page: number, totalPages: number): number {
    if (totalPages <= 0) return 0;
    return Math.min(Math.max(Math.round(page) || 1, 1), totalPages);
}
