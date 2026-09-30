import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlipBook } from './FlipBook';
import { FlipBookPage } from './FlipBookPage';

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
});
