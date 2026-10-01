import { useRef, useState } from 'react';
import { FlipBook, FlipBookPage, type FlipBookRef, type TurnDisplay } from 'react-turnjs';
import type { CSSProperties } from 'react';

function sheet(bg: string, color = '#fff'): CSSProperties {
    return {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 24,
        textAlign: 'center',
        background: bg,
        color,
    };
}

const numeral: CSSProperties = {
    margin: 0,
    fontSize: 110,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: -4,
};

const caption: CSSProperties = { margin: 0, fontSize: 15, opacity: 0.85 };

const COVER_BG = 'linear-gradient(135deg, #141e46 0%, #0f3460 60%, #533483 100%)';
const BACK_BG = 'linear-gradient(135deg, #212529 0%, #343a40 70%, #0f3460 100%)';

export default function App() {
    const ref = useRef<FlipBookRef>(null);
    const [display, setDisplay] = useState<TurnDisplay>('double');
    const [duration, setDuration] = useState(600);
    const [gradients, setGradients] = useState(true);
    const [log, setLog] = useState<string[]>([]);

    const pushLog = (msg: string) => setLog((prev) => [msg, ...prev].slice(0, 5));

    return (
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 16px 64px' }}>
            <header style={{ textAlign: 'center', marginBottom: 24 }}>
                <h1 style={{ margin: '0 0 8px', fontSize: 40 }}>
                    react<span style={{ color: '#e94560' }}>-turnjs</span>
                </h1>
                <p style={{ margin: 0, opacity: 0.7 }}>
                    Drag from a page corner, use arrow keys, or the buttons below.
                </p>
            </header>

            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    background: '#1f2b4d',
                    border: '1px solid #2c3a5e',
                    borderRadius: 12,
                    padding: '12px 16px',
                }}
            >
                <label>
                    Display:{' '}
                    <select
                        value={display}
                        onChange={(e) => setDisplay(e.target.value as TurnDisplay)}
                    >
                        <option value="double">double</option>
                        <option value="single">single</option>
                    </select>
                </label>
                <label>
                    Duration: {duration}ms{' '}
                    <input
                        type="range"
                        min={0}
                        max={1500}
                        step={50}
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                    />
                </label>
                <label>
                    <input
                        type="checkbox"
                        checked={gradients}
                        onChange={(e) => setGradients(e.target.checked)}
                    />{' '}
                    Gradients
                </label>
                <button onClick={() => ref.current?.goTo(1)}>First</button>
                <button onClick={() => ref.current?.goTo(3)}>Go to 3</button>
                <button onClick={() => ref.current?.previous()}>Prev (ref)</button>
                <button onClick={() => ref.current?.next()}>Next (ref)</button>
            </div>

            <div
                style={{
                    borderRadius: 12,
                    padding: 16,
                    background: '#10142b',
                    border: '1px solid #2c3a5e',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                }}
            >
                <FlipBook
                    ref={ref}
                    width="100%"
                    height={480}
                    display={display}
                    duration={duration}
                    gradients={gradients}
                    onTurning={(page, view) => pushLog(`turning → ${page} [${view.join(', ')}]`)}
                    onTurned={(page, view) => pushLog(`turned → ${page} [${view.join(', ')}]`)}
                    onFirst={() => pushLog('first page')}
                    onLast={() => pushLog('last page')}
                >
                    <FlipBookPage hard>
                        <div style={{ ...sheet(COVER_BG), gap: 10 }}>
                            <div style={{ fontSize: 13, letterSpacing: 6, color: '#e9c46a' }}>
                                REACT-TURNJS
                            </div>
                            <h2 style={{ margin: 0, fontSize: 44, lineHeight: 1.05 }}>
                                The Great Flip Book
                            </h2>
                            <p style={{ margin: 0, opacity: 0.8 }}>
                                Drag the bottom-right corner →
                            </p>
                        </div>
                    </FlipBookPage>
                    <FlipBookPage>
                        <div style={sheet('#e63946')}>
                            <p style={numeral}>02</p>
                            <p style={caption}>Sunset spread — pages 2–3 side by side</p>
                        </div>
                    </FlipBookPage>
                    <FlipBookPage>
                        <div style={sheet('#2a9d8f')}>
                            <p style={numeral}>03</p>
                            <p style={caption}>Same view math as turn.js: [2, 3]</p>
                        </div>
                    </FlipBookPage>
                    <FlipBookPage>
                        <div style={sheet('#e9c46a', '#3a2c00')}>
                            <p style={numeral}>04</p>
                            <p style={caption}>Try the ← → keyboard arrows too</p>
                        </div>
                    </FlipBookPage>
                    <FlipBookPage>
                        <div style={sheet('#7b2cbf')}>
                            <p style={numeral}>05</p>
                            <p style={caption}>Almost at the back cover</p>
                        </div>
                    </FlipBookPage>
                    <FlipBookPage hard>
                        <div style={{ ...sheet(BACK_BG), gap: 10 }}>
                            <div style={{ fontSize: 13, letterSpacing: 6, color: '#e9c46a' }}>
                                FIN
                            </div>
                            <h2 style={{ margin: 0, fontSize: 44 }}>The End</h2>
                            <p style={{ margin: 0, opacity: 0.8 }}>
                                ← Drag the bottom-left corner back
                            </p>
                        </div>
                    </FlipBookPage>
                </FlipBook>
            </div>

            {log.length > 0 && (
                <div
                    style={{
                        marginTop: 16,
                        fontFamily: 'monospace',
                        fontSize: 13,
                        background: '#10142b',
                        border: '1px solid #2c3a5e',
                        borderRadius: 8,
                        padding: '10px 14px',
                        color: '#7df9ff',
                    }}
                >
                    {log.map((line, i) => (
                        <div key={`${i}-${line}`}>{line}</div>
                    ))}
                </div>
            )}

            <footer style={{ marginTop: 32, textAlign: 'center', opacity: 0.6, fontSize: 14 }}>
                <span>Demo imports from &apos;react-turnjs&apos; (aliased to ../src in dev).</span>
            </footer>
        </div>
    );
}
