import type { CSSProperties } from 'react';
import type { FlipBookPageProps } from './types';

const defaultPageStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    background: '#fff',
    boxSizing: 'border-box',
};

export function FlipBookPage({ children, className = '', style, hard = false }: FlipBookPageProps) {
    return (
        <div
            className={`react-turn-page page ${hard ? 'hard' : 'sheet'} ${className}`.trim()}
            style={{
                ...defaultPageStyle,
                boxShadow: hard ? 'inset 0 0 8px rgba(0,0,0,0.25)' : 'none',
                ...style,
            }}
        >
            {children}
        </div>
    );
}
