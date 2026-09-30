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
    type ReactNode,
} from 'react';
import { clampPage, nextPage, pageRange, prevPage, viewForPage } from './turnUtils';
import type { FlipBookProps, FlipBookRef, TurnDisplay } from './types';

interface FlipState {
    from: number;
    to: number;
    forward: boolean;
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
    const [flip, setFlip] = useState<FlipState | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animatingRef = useRef(false);

    const isControlled = controlledPage !== undefined;
    const display: TurnDisplay = displayProp ?? displayState;
    const current = isControlled
        ? clampPage(controlledPage ?? 1, Math.max(totalPages, 1))
        : uncontrolledPage;
    const isDisabled = disabledState;

    // keep internal states in sync with props
    useEffect(() => setDisplayState(displayProp), [displayProp]);
    useEffect(
        () => setSizeState({ width: widthProp, height: heightProp }),
        [widthProp, heightProp]
    );
    useEffect(() => setDisabledState(disabled), [disabled]);
    useEffect(() => {
        if (!isControlled) setUncontrolledPage((p) => clampPage(p, Math.max(totalPages, 1)));
    }, [totalPages, isControlled]);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        []
    );

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

    const commit = useCallback(
        (target: number) => {
            if (!isControlled) setUncontrolledPage(target);
            setFlip(null);
            animatingRef.current = false;
            fireTurned(target);
        },
        [isControlled, fireTurned]
    );

    const goTo = useCallback(
        (target: number) => {
            const clamped = clampPage(target, totalPages);
            if (totalPages === 0 || clamped === current || animatingRef.current || isDisabled)
                return;
            const forward = clamped > current;
            const v = viewForPage(clamped, totalPages, display);
            if (onStart?.(clamped, v) === false) return;
            onTurning?.(clamped, v);

            if (duration <= 0) {
                commit(clamped);
                return;
            }
            animatingRef.current = true;
            setFlip({ from: current, to: clamped, forward });
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => commit(clamped), duration);
        },
        [totalPages, current, isDisabled, display, onStart, onTurning, duration, commit]
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
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        if (animatingRef.current && flip) {
            // settle on the target page immediately
            commit(flip.to);
        }
    }, [flip, commit]);

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
            isAnimating: () => animatingRef.current,
            stop,
            hasPage: (p: number) => p >= 1 && p <= totalPages,
            getRange: (p?: number) => pageRange(p ?? current, totalPages, display),
        }),
        [next, previous, goTo, current, totalPages, display, stop]
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

    const accel = acceleration ? 'translateZ(0)' : undefined;
    const pageWidth = display === 'double' ? '50%' : '100%';

    const sheetStyle = (side: 'left' | 'right'): CSSProperties => ({
        width: pageWidth,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: '#fff',
        boxSizing: 'border-box',
        ...(side === 'left'
            ? { borderRight: display === 'double' ? '1px solid #e5e0d5' : undefined }
            : { borderLeft: display === 'double' ? '1px solid #e5e0d5' : undefined }),
    });

    // The flipping leaf: covers the turning half and rotates in 3D.
    const renderLeaf = () => {
        if (!flip) return null;
        const { from, to, forward } = flip;
        // Forward turn: right half flips left. Backward: left half flips right.
        const leafSide = forward ? 'right' : 'left';
        const frontContent = pageContent(forward ? from : from);
        const backContent = pageContent(to);
        return (
            <div
                data-testid="flipbook-leaf"
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    ...(leafSide === 'right'
                        ? { left: '50%', right: 0 }
                        : { left: 0, right: '50%' }),
                    perspective: '2000px',
                    zIndex: 10,
                    pointerEvents: 'none',
                }}
            >
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        transformStyle: 'preserve-3d',
                        transform: forward ? 'rotateY(-180deg)' : 'rotateY(180deg)',
                        transition: `transform ${duration}ms ease`,
                        ...(acceleration ? { willChange: 'transform' } : null),
                    }}
                >
                    {/* front face: page being turned */}
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            overflow: 'hidden',
                            background: '#fff',
                            ...(gradients
                                ? { boxShadow: 'inset -12px 0 24px -12px rgba(0,0,0,0.4)' }
                                : null),
                        }}
                    >
                        {frontContent}
                    </div>
                    {/* back face: target page */}
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                            overflow: 'hidden',
                            background: '#fff',
                            ...(gradients
                                ? { boxShadow: 'inset 12px 0 24px -12px rgba(0,0,0,0.4)' }
                                : null),
                        }}
                    >
                        {backContent}
                    </div>
                </div>
            </div>
        );
    };

    const handleZoneClick = (side: 'left' | 'right') => {
        if (!clickable || isDisabled || animatingRef.current) return;
        if (side === 'right') void next();
        else void previous();
    };

    const atFirst = current <= 1;
    const atLast = current >= totalPages || totalPages === 0;

    return (
        <div
            className={`react-turn-book ${className}`.trim()}
            style={{
                width: sizeState.width,
                height: sizeState.height,
                position: 'relative',
                overflow: 'hidden',
                margin: shouldAutoCenter(display, autoCenter) ? '0 auto' : undefined,
                background: '#f3f1ea',
                perspective: '2000px',
                ...(accel ? { transform: accel } : null),
                ...style,
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
                        className={`page ${pageClass(current)}`.trim()}
                        style={sheetStyle('right')}
                        data-testid={`flipbook-page-${current}`}
                        data-active
                    >
                        {pageContent(current)}
                    </div>
                ) : (
                    <>
                        <div
                            className={`page ${pageClass(view[0])}`.trim()}
                            style={sheetStyle('left')}
                            data-testid={`flipbook-page-${view[0]}`}
                            data-active={flip ? undefined : true}
                            onClick={() => handleZoneClick('left')}
                        >
                            {pageContent(view[0])}
                        </div>
                        <div
                            className={`page ${pageClass(view[1] ?? 0)}`.trim()}
                            style={sheetStyle('right')}
                            data-testid={`flipbook-page-${view[1] ?? 0}`}
                            data-active={flip ? undefined : true}
                            onClick={() => handleZoneClick('right')}
                        >
                            {pageContent(view[1] ?? 0)}
                        </div>
                    </>
                )}
            </div>

            {renderLeaf()}

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

            {showNavigation && totalPages > 1 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0 12px',
                        pointerEvents: 'none',
                        zIndex: 20,
                    }}
                >
                    <button
                        type="button"
                        onClick={previous}
                        disabled={atFirst || isDisabled}
                        style={{ pointerEvents: 'auto' }}
                        aria-label="Previous page"
                    >
                        Prev
                    </button>
                    <span data-testid="flipbook-indicator" style={{ pointerEvents: 'auto' }}>
                        {totalPages === 0 ? '0 / 0' : `${current} / ${totalPages}`}
                    </span>
                    <button
                        type="button"
                        onClick={next}
                        disabled={atLast || isDisabled}
                        style={{ pointerEvents: 'auto' }}
                        aria-label="Next page"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
});

function shouldAutoCenter(display: TurnDisplay, autoCenter: boolean): boolean {
    return display === 'double' && autoCenter;
}
