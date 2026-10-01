import type { CSSProperties, ReactNode } from 'react';

export type TurnDisplay = 'single' | 'double';

/** 1-indexed view: [left, right]. 0 means "no page" (cover edge). Single mode uses [page]. */
export type TurnView = [number, number] | [number];

export interface FlipBookPageProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    /** Render as a hard cover page (stiffer look, higher z-index). Mirrors turn.js `.hard`. */
    hard?: boolean;
}

export interface FlipBookProps {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
    width?: number | string;
    height?: number | string;
    /** turn.js-compatible: 'single' | 'double'. Default 'double'. */
    display?: TurnDisplay;
    /** Controlled page (1-indexed, like turn.js). */
    page?: number;
    /** Uncontrolled initial page (1-indexed). Default 1. */
    defaultPage?: number;
    /** Flip duration in ms. Default 600 (same as turn.js). */
    duration?: number;
    /** Show gradient/shadow overlays during flip. Default true. */
    gradients?: boolean;
    /** Use translateZ(0) hardware acceleration hint. Default true. */
    acceleration?: boolean;
    /** Disable all interactions. Default false. */
    disabled?: boolean;
    /** Center the book when a single page is visible in double mode. Default true. */
    autoCenter?: boolean;
    /** Show Prev/Next controls (extension, not in turn.js). Default true. */
    showNavigation?: boolean;
    /** Click left/right half of the book to turn. Default true. */
    clickable?: boolean;
    /**
     * Size in px of the corner grab zone for drag-to-flip.
     * Same meaning as turn.js `cornerSize`. Default 100.
     */
    cornerSize?: number;

    // --- turn.js events (1-indexed) ---
    /** Fired before the flip starts. Return false to cancel. */
    onStart?: (page: number, view: number[]) => void | false;
    /** Fired before a page starts turning. */
    onTurning?: (page: number, view: number[]) => void;
    /** Fired when a page has been turned. */
    onTurned?: (page: number, view: number[]) => void;
    /** Fired when the book reaches the first page. */
    onFirst?: () => void;
    /** Fired when the book reaches the last page. */
    onLast?: () => void;
    /** Alias of onTurned (1-indexed). Kept for convenience. */
    onPageChange?: (page: number) => void;

    // --- deprecated v0.1 props (0-indexed). Use `page`/`defaultPage` instead. ---
    /** @deprecated Use `defaultPage` (1-indexed) instead. */
    initialPage?: number;
}

export interface FlipBookRef {
    /** turn.js `next()` — go to next view. */
    next: () => void;
    /** turn.js `previous()`. Kept `prev` as alias. */
    previous: () => void;
    prev: () => void;
    /** turn.js `page(n)` — 1-indexed. */
    goTo: (page: number) => void;
    /** Current page (1-indexed). */
    getPage: () => number;
    getPageCount: () => number;
    /** Current view, e.g. [1, 2]. */
    getView: () => number[];
    getDisplay: () => TurnDisplay;
    setDisplay: (display: TurnDisplay) => void;
    setSize: (width: number | string, height: number | string) => void;
    setDisabled: (disabled: boolean) => void;
    isAnimating: () => boolean;
    stop: () => void;
    hasPage: (page: number) => boolean;
    getRange: (page?: number) => [number, number];
}
