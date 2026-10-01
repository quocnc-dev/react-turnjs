import {
    Children,
    forwardRef,
    isValidElement,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from 'react';
import {
    bezierPoint,
    computeFold,
    cornerAnchor,
    detectCorner,
    easeOutCirc,
    oppositeAnchor,
    shouldCompleteTurn,
    toPolygonClip,
    travelProgress,
    type CurlCorner,
    type Point,
} from './curl';
import { clampPage, nextPage, pageRange, prevPage, viewForPage } from './turnUtils';
import type { FlipBookProps, FlipBookRef, TurnDisplay } from './types';

interface ActiveCurl {
    corner: CurlCorner;
    hard: boolean;
    forward: boolean;
    /** 1-indexed target page, committed on complete. */
    target: number;
    /** 1-indexed page shown on the front face. */
    turningPage: number;
    /** Current fold point in turning-page coordinates. */
    x: number;
    y: number;
    grabX: number;
    grabY: number;
    pageW: number;
    pageH: number;
    /** Client coords of the turning half's top-left at grab (for window drag). */
    boxLeft: number;
    boxTop: number;
    dragging: boolean;
    startedAt: number;
    moved: number;
}

function isHardChild(child: ReactNode): boolean {
    return (
        isValidElement(child) &&
        typeof child.props === 'object' &&
        child.props !== null &&
        'hard' in child.props &&
        (child.props as { hard?: boolean }).hard === true
    );
}

function BlankPage({ label }: { label: string }) {
    return (
        <div
            aria-hidden
            style={{
                width: '100%',
                height: '100%',
                background: '#f3f1ea',
                boxSizing: 'border-box',
            }}
            data-blank={label}
        />
    );
}

function shouldAutoCenter(display: TurnDisplay, autoCenter: boolean): boolean {
    return display === 'double' && autoCenter;
}

export const FlipBook = forwardRef<FlipBookRef, FlipBookProps>(function FlipBook(
    {
        children,
        className = '',
        style,
        width: widthProp = '100%',
        height: heightProp = 480,
        display: displayProp = 'double',
        page: controlledPage,
        defaultPage,
        initialPage,
        duration = 600,
        gradients = true,
        acceleration = true,
        disabled = false,
        autoCenter = true,
        showNavigation = true,
        clickable = true,
        cornerSize = 100,
        onStart,
        onTurning,
        onTurned,
        onFirst,
        onLast,
        onPageChange,
    },
    ref
) {
    const pages = useMemo(() => Children.toArray(children), [children]);
    const totalPages = pages.length;

    const resolvedDefault = defaultPage ?? (initialPage !== undefined ? initialPage + 1 : 1);

    const [uncontrolledPage, setUncontrolledPage] = useState(() =>
        clampPage(resolvedDefault, Math.max(totalPages, 1))
    );
    const [displayState, setDisplayState] = useState<TurnDisplay>(displayProp);
    const [sizeState, setSizeState] = useState({ width: widthProp, height: heightProp });
    const [disabledState, setDisabledState] = useState(disabled);
    const [curl, setCurl] = useState<ActiveCurl | null>(null);

    const rafId = useRef<number | null>(null);
    const curlRef = useRef<ActiveCurl | null>(null);
    const suppressClick = useRef(false);

    const isControlled = controlledPage !== undefined;
    const display: TurnDisplay = displayProp ?? displayState;
    const current = isControlled
        ? clampPage(controlledPage ?? 1, Math.max(totalPages, 1))
        : uncontrolledPage;
    const isDisabled = disabledState;

    useEffect(() => setDisplayState(displayProp), [displayProp]);
    useEffect(
        () => setSizeState({ width: widthProp, height: heightProp }),
        [widthProp, heightProp]
    );
    useEffect(() => setDisabledState(disabled), [disabled]);
    useEffect(() => {
        if (!isControlled) setUncontrolledPage((p) => clampPage(p, Math.max(totalPages, 1)));
    }, [totalPages, isControlled]);

    const stopFlight = useCallback(() => {
        if (rafId.current !== null) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
        }
    }, []);

    useEffect(() => stopFlight, [stopFlight]);
    useEffect(() => {
        curlRef.current = curl;
    }, [curl]);

    const view = useMemo(
        () => viewForPage(current, totalPages, display),
        [current, totalPages, display]
    );

    const fireTurned = useCallback(
        (target: number) => {
            const v = viewForPage(target, totalPages, display);
            onTurned?.(target, v);
            onPageChange?.(target);
            if (target === 1) onFirst?.();
            if (target === totalPages && totalPages > 0) onLast?.();
        },
        [onTurned, onPageChange, onFirst, onLast, totalPages, display]
    );

    const cancelCurl = useCallback(() => {
        stopFlight();
        setCurl(null);
    }, [stopFlight]);

    const commit = useCallback(
        (target: number) => {
            stopFlight();
            setCurl(null);
            if (!isControlled) setUncontrolledPage(target);
            fireTurned(target);
        },
        [stopFlight, isControlled, fireTurned]
    );

    /** rAF bezier flight of the fold point (turn.js `turnPage` equivalent). */
    const flyTo = useCallback(
        (from: Point, to: Point, dur: number, settle: 'commit' | 'cancel', target: number) => {
            stopFlight();
            if (dur <= 0 || typeof requestAnimationFrame === 'undefined') {
                if (settle === 'commit') commit(target);
                else cancelCurl();
                return;
            }
            const start = Date.now();
            const tick = () => {
                const t = Math.min(1, (Date.now() - start) / dur);
                const p = bezierPoint(from, from, to, to, easeOutCirc(t));
                setCurl((c) => (c ? { ...c, x: p.x, y: p.y, dragging: false } : c));
                if (t < 1) {
                    rafId.current = requestAnimationFrame(tick);
                } else {
                    rafId.current = null;
                    if (settle === 'commit') commit(target);
                    else cancelCurl();
                }
            };
            rafId.current = requestAnimationFrame(tick);
        },
        [stopFlight, commit, cancelCurl]
    );

    const isHardPage = useCallback(
        (n: number) => n >= 1 && n <= totalPages && isHardChild(pages[n - 1]),
        [pages, totalPages]
    );

    /** Fallback turning-page size when the DOM box can't be measured (tests). */
    const defaultPageSize = useCallback(() => {
        const w =
            typeof sizeState.width === 'number'
                ? display === 'double'
                    ? sizeState.width / 2
                    : sizeState.width
                : 300;
        const h = typeof sizeState.height === 'number' ? sizeState.height : 480;
        return { w: Math.max(w, 1), h: Math.max(h, 1) };
    }, [sizeState, display]);

    const beginCurl = useCallback(
        (
            corner: CurlCorner,
            forward: boolean,
            target: number,
            origin: Point,
            pageW: number,
            pageH: number,
            dragging: boolean,
            boxLeft = 0,
            boxTop = 0
        ) => {
            const turningPage = display === 'double' ? (forward ? view[1] : view[0]) : current;
            setCurl({
                corner,
                hard: isHardPage(turningPage),
                forward,
                target,
                turningPage,
                x: origin.x,
                y: origin.y,
                grabX: origin.x,
                grabY: origin.y,
                pageW,
                pageH,
                boxLeft,
                boxTop,
                dragging,
                startedAt: Date.now(),
                moved: 0,
            });
        },
        [display, view, current, isHardPage]
    );

    const goTo = useCallback(
        (target: number) => {
            const clamped = clampPage(target, totalPages);
            if (totalPages === 0 || clamped === current || isDisabled || curl) return;
            const forward = clamped > current;
            const v = viewForPage(clamped, totalPages, display);
            if (onStart?.(clamped, v) === false) return;
            onTurning?.(clamped, v);
            if (duration <= 0) {
                commit(clamped);
                return;
            }
            const corner: CurlCorner = forward ? 'br' : 'bl';
            const { w: pageW, h: pageH } = defaultPageSize();
            const grab = cornerAnchor(corner, pageW, pageH);
            beginCurl(corner, forward, clamped, grab, pageW, pageH, false);
            flyTo(grab, oppositeAnchor(corner, pageW, pageH), duration, 'commit', clamped);
        },
        [
            totalPages,
            current,
            isDisabled,
            curl,
            display,
            onStart,
            onTurning,
            duration,
            commit,
            defaultPageSize,
            beginCurl,
            flyTo,
        ]
    );

    const next = useCallback(
        () => goTo(nextPage(current, totalPages, display)),
        [goTo, current, totalPages, display]
    );
    const previous = useCallback(
        () => goTo(prevPage(current, totalPages, display)),
        [goTo, current, totalPages, display]
    );

    const stop = useCallback(() => {
        if (!curl) return;
        if (curl.dragging) {
            flyTo(
                { x: curl.x, y: curl.y },
                { x: curl.grabX, y: curl.grabY },
                200,
                'cancel',
                curl.target
            );
        } else {
            commit(curl.target);
        }
    }, [curl, flyTo, commit]);

    useImperativeHandle(
        ref,
        () => ({
            next,
            previous,
            prev: previous,
            goTo,
            getPage: () => current,
            getPageCount: () => totalPages,
            getView: () => viewForPage(current, totalPages, display),
            getDisplay: () => display,
            setDisplay: (d: TurnDisplay) => setDisplayState(d),
            setSize: (w, h) => setSizeState({ width: w, height: h }),
            setDisabled: (d: boolean) => setDisabledState(d),
            isAnimating: () => curl !== null && !curl.dragging,
            stop,
            hasPage: (p: number) => p >= 1 && p <= totalPages,
            getRange: (p?: number) => pageRange(p ?? current, totalPages, display),
        }),
        [next, previous, goTo, current, totalPages, display, curl, stop]
    );

    const pageContent = (n: number): ReactNode => {
        if (n < 1 || n > totalPages)
            return <BlankPage label={n <= 0 ? 'cover-start' : 'cover-end'} />;
        return pages[n - 1];
    };

    const pageClass = (n: number) => {
        if (n < 1 || n > totalPages) return 'blank';
        const oddEven = n % 2 === 1 ? 'odd' : 'even';
        return `p${n} ${oddEven}${isHardChild(pages[n - 1]) ? ' hard' : ''}`;
    };

    // ---------- corner drag ----------

    const measureHalf = (el: HTMLElement | null) => {
        const rect = el?.getBoundingClientRect();
        const fb = defaultPageSize();
        return {
            w: rect && rect.width > 0 ? rect.width : fb.w,
            h: rect && rect.height > 0 ? rect.height : fb.h,
            left: rect?.left ?? 0,
            top: rect?.top ?? 0,
        };
    };

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        suppressClick.current = false;
        if (!clickable || isDisabled || curl) return;
        const m = measureHalf(e.currentTarget);
        const x = e.clientX - m.left;
        const y = e.clientY - m.top;
        const corner = detectCorner(x, y, m.w, m.h, cornerSize);
        if (!corner) return; // plain click handled by onClick
        const forward = corner === 'tr' || corner === 'br';
        const target = forward
            ? nextPage(current, totalPages, display)
            : prevPage(current, totalPages, display);
        if (target === current) return;
        if (onStart?.(target, viewForPage(target, totalPages, display)) === false) return;
        beginCurl(corner, forward, target, { x, y }, m.w, m.h, true, m.left, m.top);
    };

    // Document-level drag tracking (like turn.js): the fold follows the
    // pointer even outside the page, on every browser.
    useEffect(() => {
        if (!curl?.dragging) return;
        const onMove = (e: PointerEvent) => {
            const c = curlRef.current;
            if (!c?.dragging) return;
            const x = e.clientX - c.boxLeft;
            const y = e.clientY - c.boxTop;
            setCurl((prev) =>
                prev
                    ? {
                          ...prev,
                          x,
                          y,
                          moved: Math.max(prev.moved, Math.hypot(x - prev.grabX, y - prev.grabY)),
                      }
                    : prev
            );
        };
        const onUp = () => {
            const c = curlRef.current;
            if (!c?.dragging) return;
            suppressClick.current = true;
            const progress = travelProgress(c.x, c.corner, c.pageW);
            const elapsed = Date.now() - c.startedAt;
            // tap (no real drag) always turns, like turn.js quick-release
            const complete =
                (c.moved < 8 && elapsed < 400) || shouldCompleteTurn(progress, elapsed, c.moved);
            if (complete) {
                onTurning?.(c.target, viewForPage(c.target, totalPages, display));
                flyTo(
                    { x: c.x, y: c.y },
                    oppositeAnchor(c.corner, c.pageW, c.pageH),
                    Math.max(140, duration * 0.7),
                    'commit',
                    c.target
                );
            } else {
                flyTo({ x: c.x, y: c.y }, { x: c.grabX, y: c.grabY }, 260, 'cancel', c.target);
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [curl?.dragging, flyTo, duration, display, totalPages, onTurning]);

    const handleHalfClick = (side: 'left' | 'right') => (e: ReactMouseEvent<HTMLDivElement>) => {
        if (suppressClick.current) {
            suppressClick.current = false;
            return;
        }
        if (!clickable || isDisabled || curl) return;
        if (display === 'single') {
            // single page: pick direction from the click position
            const rect = e.currentTarget.getBoundingClientRect();
            const mid = rect.width > 0 ? rect.left + rect.width / 2 : 0;
            if (e.clientX < mid) {
                previous();
                return;
            }
            next();
            return;
        }
        if (side === 'right') next();
        else previous();
    };

    // ---------- render ----------

    const accel = acceleration ? 'translateZ(0)' : undefined;
    const pageWidth = display === 'double' ? '50%' : '100%';

    const sheetStyle = (side: 'left' | 'right'): CSSProperties => ({
        width: pageWidth,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: '#fff',
        boxSizing: 'border-box',
        touchAction: 'none',
        ...(side === 'left'
            ? { borderRight: display === 'double' ? '1px solid #e5e0d5' : undefined }
            : { borderLeft: display === 'double' ? '1px solid #e5e0d5' : undefined }),
    });

    const renderCurlOverlay = (c: ActiveCurl) => {
        if (!c) return null;
        const { corner, hard, forward, turningPage, target, x, y, pageW, pageH } = c;
        // Dissolve the overlay over the last stretch so its removal swaps
        // nothing visible (the spread underneath is already final).
        const dissolve =
            travelProgress(x, corner, pageW) > 0.9
                ? Math.max(0, 1 - (travelProgress(x, corner, pageW) - 0.9) / 0.1)
                : 1;
        // Full-book overlay (like turn.js fparent): the fold travels across
        // the spine and lands on the other side.
        const overlayStyle: CSSProperties = {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '100%',
            overflow: 'hidden',
            perspective: '1600px',
            zIndex: 30,
            pointerEvents: 'none',
            opacity: dissolve,
        };
        // Turning-half box inside the book.
        const halfLeft = display === 'single' ? 0 : forward ? '50%' : 0;
        const halfWidth = display === 'double' ? '50%' : '100%';
        // Book x-offset of the turning half: flap math runs in page coords.
        const turnDX = display === 'double' && forward ? pageW : 0;

        if (hard) {
            // stiff cover: rotateY driven by horizontal drag (turn.js hard effect).
            // The card swings across the spine, back face landing on far side.
            const progress = travelProgress(x, corner, pageW);
            const angle = forward ? -180 * progress : 180 * progress;
            const origin = forward ? '0% 50%' : '100% 50%';
            const shade = Math.sin(progress * Math.PI);
            // outer edge of the swinging card, in book coords (for its shadow)
            const edgeRad = (angle * Math.PI) / 180;
            const edgeX = forward
                ? turnDX + pageW * Math.cos(edgeRad)
                : pageW - pageW * Math.cos(edgeRad);
            return (
                <div data-testid="flipbook-curl" style={overlayStyle}>
                    {/* drop shadow cast by the swinging card onto the book */}
                    {gradients && shade > 0.03 && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: edgeX - 30,
                                width: 60,
                                background:
                                    'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 100%)',
                                filter: 'blur(10px)',
                                opacity: 0.8 * shade,
                            }}
                        />
                    )}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: halfLeft,
                            width: halfWidth,
                            overflow: 'visible',
                        }}
                    >
                        <div
                            data-testid="flipbook-card"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                transformStyle: 'preserve-3d',
                                transform: `rotateY(${angle}deg)`,
                                transformOrigin: origin,
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backfaceVisibility: 'hidden',
                                    background: '#fff',
                                }}
                            >
                                {pageContent(turningPage)}
                                {gradients && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: '#000',
                                            opacity: 0.35 * shade,
                                        }}
                                    />
                                )}
                            </div>
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    background: '#fff',
                                }}
                            >
                                {pageContent(target)}
                                {gradients && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: '#000',
                                            opacity: 0.4 * shade,
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        const frame = computeFold(x, y, corner, pageW, pageH);
        // pointer still on the corner: full page, no visible fold yet
        const shadow = frame?.shadow ?? 0;
        const curve = frame ? Math.sin(frame.progress * Math.PI) : 0;
        // 3D life for the flap: pivot at the turning half's spine edge so the
        // paper visibly lifts off the surface inside the (static) clip window.
        // Content sits in the turning-half box (same footprint as the front)
        // so it always overlaps the clip window.
        const swing = (forward ? -1 : 1) * 24 * curve;
        const lift = 70 * curve;
        const spineOrigin = forward ? '0% 50%' : '100% 50%';
        // fold edge F1-F2 in book coords, for the crease shadow bar
        const f1b = frame ? { x: frame.flap[1].x + turnDX, y: frame.flap[1].y } : null;
        const f2b = frame ? { x: frame.flap[2].x + turnDX, y: frame.flap[2].y } : null;
        const edgeLen = f1b && f2b ? Math.hypot(f2b.x - f1b.x, f2b.y - f1b.y) : 0;
        const edgeAng = f1b && f2b ? (Math.atan2(f2b.y - f1b.y, f2b.x - f1b.x) * 180) / Math.PI : 0;
        // moving curl-roll highlight near the fold point (book coords)
        const rollSize = Math.max(60, pageW * 0.35);
        return (
            <div data-testid="flipbook-curl" style={overlayStyle}>
                {/* front face: the turning page minus the folded triangle */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: halfLeft,
                        width: halfWidth,
                        background: '#fff',
                        overflow: 'hidden',
                        ...(frame ? { clipPath: frame.frontClip } : null),
                    }}
                >
                    {pageContent(turningPage)}
                </div>
                {/* back face: target page, readable, folded OVER the front.
                    Painted above so the flap (not the flat front) wins the
                    fold region. */}
                {frame && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: '100%',
                            clipPath: toPolygonClip(
                                frame.flap.map((p) => ({ x: p.x + turnDX, y: p.y }))
                            ),
                        }}
                    >
                        <div
                            style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: halfLeft,
                                width: halfWidth,
                                background: '#fff',
                                overflow: 'visible',
                                transform: `perspective(1200px) rotateY(${swing}deg) translateZ(${lift}px)`,
                                transformOrigin: spineOrigin,
                            }}
                        >
                            {pageContent(target)}
                        </div>
                    </div>
                )}
                {frame && gradients && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            clipPath: toPolygonClip(
                                frame.flap.map((p) => ({ x: p.x + turnDX, y: p.y }))
                            ),
                            background: `linear-gradient(${
                                forward ? 'to left' : 'to right'
                            }, rgba(0,0,0,${0.45 * shadow}), rgba(0,0,0,0))`,
                        }}
                    />
                )}
                {/* crease shadow exactly along the fold edge F1-F2 */}
                {frame && f1b && f2b && edgeLen > 4 && (
                    <div
                        style={{
                            position: 'absolute',
                            left: (f1b.x + f2b.x) / 2 - edgeLen / 2,
                            top: (f1b.y + f2b.y) / 2 - 8,
                            width: edgeLen,
                            height: 16,
                            transform: `rotate(${edgeAng}deg)`,
                            background:
                                'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0) 100%)',
                            borderRadius: 8,
                            opacity: Math.min(1, 0.3 + shadow),
                        }}
                    />
                )}
                {/* curl roll highlight tracking the fold */}
                {gradients && shadow > 0.02 && (
                    <div
                        style={{
                            position: 'absolute',
                            left: turnDX + x - rollSize / 2,
                            top: y - rollSize / 2,
                            width: rollSize,
                            height: rollSize,
                            borderRadius: '50%',
                            background:
                                'radial-gradient(circle, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0) 70%)',
                            opacity: shadow,
                        }}
                    />
                )}
            </div>
        );
    };

    const atFirst = current <= 1;
    const atLast = current >= totalPages || totalPages === 0;
    const busy = curl !== null;
    // Spread placement during a curl: the turning half always shows the
    // target spread (covered by the overlay). The static half swaps once
    // the fold is committed past 75% travel — under the landing flap and
    // fast motion — so the commit itself swaps nothing visible. Pulling
    // back reverts it the same way, masked by the return motion.
    const targetView = curl ? viewForPage(curl.target, totalPages, display) : null;
    const pass = curl ? travelProgress(curl.x, curl.corner, curl.pageW) : 0;
    const landed = pass > 0.75;
    const shownLeft =
        curl && targetView && (display === 'single' || !curl.forward || landed)
            ? targetView[0]
            : view[0];
    const shownRight =
        curl && targetView && (display === 'single' || curl.forward || landed)
            ? (targetView[1] ?? targetView[0])
            : (view[1] ?? view[0]);
    const shownSingle = curl ? curl.target : current;

    return (
        <div
            className={`react-turn-book ${className}`.trim()}
            style={{
                width: sizeState.width,
                margin: shouldAutoCenter(display, autoCenter) ? '0 auto' : undefined,
                ...style,
            }}
        >
            <div
                style={{
                    width: '100%',
                    height: sizeState.height,
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#f3f1ea',
                    perspective: '2000px',
                    ...(accel ? { transform: accel } : null),
                }}
                data-testid="flipbook"
                data-page={current}
                data-display={display}
                tabIndex={0}
                role="region"
                aria-label={`Flip book, page ${current} of ${totalPages}`}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') next();
                    if (e.key === 'ArrowLeft') previous();
                }}
            >
                <div
                    style={{ display: 'flex', width: '100%', height: '100%' }}
                    data-testid="flipbook-track"
                >
                    {display === 'single' ? (
                        <div
                            className={`page ${pageClass(shownSingle)}`.trim()}
                            style={sheetStyle('right')}
                            data-testid={`flipbook-page-${shownSingle}`}
                            data-active
                            onPointerDown={handlePointerDown}
                            onClick={handleHalfClick('right')}
                        >
                            {pageContent(shownSingle)}
                        </div>
                    ) : (
                        <>
                            <div
                                className={`page ${pageClass(shownLeft)}`.trim()}
                                style={sheetStyle('left')}
                                data-testid={`flipbook-page-${shownLeft}`}
                                data-active={curl ? undefined : true}
                                onPointerDown={handlePointerDown}
                                onClick={handleHalfClick('left')}
                            >
                                {pageContent(shownLeft)}
                            </div>
                            <div
                                className={`page ${pageClass(shownRight)}`.trim()}
                                style={sheetStyle('right')}
                                data-testid={`flipbook-page-${shownRight}`}
                                data-active={curl ? undefined : true}
                                onPointerDown={handlePointerDown}
                                onClick={handleHalfClick('right')}
                            >
                                {pageContent(shownRight)}
                            </div>
                        </>
                    )}
                </div>

                {curl && renderCurlOverlay(curl)}

                {/* center spine shadow */}
                {display === 'double' && gradients && (
                    <div
                        aria-hidden
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: '50%',
                            width: 24,
                            marginLeft: -12,
                            background:
                                'linear-gradient(90deg, rgba(0,0,0,0.12), rgba(0,0,0,0) 50%, rgba(0,0,0,0.12))',
                            pointerEvents: 'none',
                        }}
                    />
                )}
            </div>
            {showNavigation && totalPages > 1 && (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 4px 0',
                    }}
                >
                    <button
                        type="button"
                        onClick={previous}
                        disabled={atFirst || isDisabled || busy}
                        aria-label="Previous page"
                    >
                        Prev
                    </button>
                    <span data-testid="flipbook-indicator">
                        {totalPages === 0 ? '0 / 0' : `${current} / ${totalPages}`}
                    </span>
                    <button
                        type="button"
                        onClick={next}
                        disabled={atLast || isDisabled || busy}
                        aria-label="Next page"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
});
