import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlipBook } from './FlipBook';
import { FlipBookPage } from './FlipBookPage';

/**
 * jsdom has no PointerEvent constructor, and RTL's synthetic pointer
 * events drop clientX — dispatch a manual bubbling event instead so the
 * component sees pointer coordinates like in a real browser.
 */
function firePointer(
    el: HTMLElement,
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    init: Record<string, number> = {}
) {
    const ev = new Event(type, { bubbles: true, cancelable: true, composed: true });
    Object.assign(ev, { pointerId: 1, ...init });
    fireEvent(el, ev);
}

describe('FlipBook (turn.js-compatible, 1-indexed)', () => {
    it('renders cover view and 1-indexed indicator', () => {
        render(
            <FlipBook duration={0}>
                <FlipBookPage>Page 1</FlipBookPage>
                <FlipBookPage>Page 2</FlipBookPage>
                <FlipBookPage>Page 3</FlipBookPage>
            </FlipBook>
        );

        expect(screen.getByTestId('flipbook')).toBeInTheDocument();
        expect(screen.getByTestId('flipbook')).toHaveAttribute('data-page', '1');
        expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('1 / 3');
        // double display: cover view shows blank + page 1
        expect(screen.getByTestId('flipbook-page-0')).toBeInTheDocument();
        expect(screen.getByTestId('flipbook-page-1')).toBeInTheDocument();
    });

    it('navigates with next / prev (duration 0 = sync)', () => {
        const onPageChange = vi.fn();
        const onTurning = vi.fn();
        const onTurned = vi.fn();
        render(
            <FlipBook
                duration={0}
                onPageChange={onPageChange}
                onTurning={onTurning}
                onTurned={onTurned}
            >
                <div>A</div>
                <div>B</div>
                <div>C</div>
                <div>D</div>
            </FlipBook>
        );

        fireEvent.click(screen.getByLabelText('Next page'));
        expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('2 / 4');
        expect(onPageChange).toHaveBeenCalledWith(2);
        expect(onTurning).toHaveBeenCalledWith(2, [2, 3]);
        expect(onTurned).toHaveBeenCalledWith(2, [2, 3]);

        fireEvent.click(screen.getByLabelText('Previous page'));
        expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('1 / 4');
    });

    it('supports single display mode', () => {
        render(
            <FlipBook display="single" duration={0} defaultPage={2}>
                <div>A</div>
                <div>B</div>
            </FlipBook>
        );
        expect(screen.getByTestId('flipbook')).toHaveAttribute('data-display', 'single');
        expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('2 / 2');
    });

    it('respects disabled', () => {
        render(
            <FlipBook duration={0} disabled>
                <div>A</div>
                <div>B</div>
            </FlipBook>
        );
        fireEvent.click(screen.getByLabelText('Next page'));
        expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('1 / 2');
    });

    it('onStart returning false cancels the turn', () => {
        const onTurned = vi.fn();
        render(
            <FlipBook duration={0} onStart={() => false} onTurned={onTurned}>
                <div>A</div>
                <div>B</div>
            </FlipBook>
        );
        fireEvent.click(screen.getByLabelText('Next page'));
        expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('1 / 2');
        expect(onTurned).not.toHaveBeenCalled();
    });

    it('shows the curl overlay during animation, then commits the page', async () => {
        render(
            <FlipBook duration={50}>
                <div>A</div>
                <div>B</div>
                <div>C</div>
                <div>D</div>
            </FlipBook>
        );

        fireEvent.click(screen.getByLabelText('Next page'));
        // curl overlay mounted immediately (peels along a bezier to the far corner)
        expect(screen.getByTestId('flipbook-curl')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('2 / 4');
        });
        expect(screen.queryByTestId('flipbook-curl')).not.toBeInTheDocument();
    });

    it('drags from the corner to turn, snaps back on short drag', async () => {
        render(
            <FlipBook duration={60}>
                <div>A</div>
                <div>B</div>
                <div>C</div>
                <div>D</div>
            </FlipBook>
        );

        // jsdom has no layout: fallback page box is 300x480, br zone is x>=200 y>=380
        const right = screen.getByTestId('flipbook-page-1');
        firePointer(right, 'pointerdown', { clientX: 290, clientY: 470 });
        expect(screen.getByTestId('flipbook-curl')).toBeInTheDocument();

        // long drag toward the opposite edge, then release -> completes
        firePointer(right, 'pointermove', { clientX: 60, clientY: 470 });
        firePointer(right, 'pointerup');
        await waitFor(() => {
            expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('2 / 4');
        });
    });

    it('snaps back when released early', async () => {
        render(
            <FlipBook duration={60}>
                <div>A</div>
                <div>B</div>
                <div>C</div>
                <div>D</div>
            </FlipBook>
        );

        const right = screen.getByTestId('flipbook-page-1');
        firePointer(right, 'pointerdown', { clientX: 290, clientY: 470 });
        // tiny slow nudge, held long enough to not count as a tap
        firePointer(right, 'pointermove', { clientX: 285, clientY: 470 });
        await new Promise((r) => setTimeout(r, 450));
        firePointer(right, 'pointerup');

        await waitFor(() => {
            expect(screen.queryByTestId('flipbook-curl')).not.toBeInTheDocument();
        });
        expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('1 / 4');
    });

    it('flips the hard cover with a rotateY card across the spine', async () => {
        render(
            <FlipBook duration={60}>
                <FlipBookPage hard>Cover</FlipBookPage>
                <FlipBookPage>Page 2</FlipBookPage>
            </FlipBook>
        );

        const right = screen.getByTestId('flipbook-page-1');
        firePointer(right, 'pointerdown', { clientX: 290, clientY: 470 });
        const card = screen.getByTestId('flipbook-card');
        expect(card.style.transform).toContain('rotateY(');

        // drag halfway: card swings toward the viewer
        firePointer(right, 'pointermove', { clientX: 150, clientY: 470 });
        expect(screen.getByTestId('flipbook-card').style.transform).toContain('rotateY(-90deg)');

        firePointer(right, 'pointerup');
        await waitFor(() => {
            expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('2 / 2');
        });
        expect(screen.queryByTestId('flipbook-curl')).not.toBeInTheDocument();
    });

    it('places the target spread under the fold when dragging page 3', async () => {
        render(
            <FlipBook duration={60} defaultPage={3}>
                <div>P1</div>
                <div>P2</div>
                <div>P3</div>
                <div>P4</div>
                <div>P5</div>
                <div>P6</div>
            </FlipBook>
        );
        expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('3 / 6');

        // grab page 3 (right half) corner
        const right = screen.getByTestId('flipbook-page-3');
        firePointer(right, 'pointerdown', { clientX: 290, clientY: 470 });
        expect(screen.getByTestId('flipbook-curl')).toBeInTheDocument();
        // static half keeps page 2 until commit; turning half stages page 5
        expect(screen.getByTestId('flipbook-page-2')).toBeInTheDocument();
        expect(screen.getByTestId('flipbook-page-5')).toBeInTheDocument();

        firePointer(right, 'pointermove', { clientX: 60, clientY: 470 });
        firePointer(right, 'pointerup');
        await waitFor(() => {
            expect(screen.getByTestId('flipbook-indicator')).toHaveTextContent('4 / 6');
        });
        expect(screen.queryByTestId('flipbook-curl')).not.toBeInTheDocument();
    });
});
