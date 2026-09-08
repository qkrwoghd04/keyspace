import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import KeyboardScene from './components/KeyboardScene';
import { KeyboardInput } from './input/KeyboardInput';
import { KEY_BY_CODE } from './keyboard/layout';
import { DEFAULT_PRESET, PRESETS } from './keyboard/presets';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function KeyboardMark() {
  return (
    <svg className="wordmark-icon" width="26" height="19" viewBox="0 0 26 19" fill="none" aria-hidden="true">
      <rect x=".8" y=".8" width="24.4" height="17.4" rx="3.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 5.7h1m4 0h1m4 0h1m4 0h1M5 9.5h1m4 0h1m4 0h1m4 0h1M5 13.3h1m4 0h6m4 0h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SoundIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8.7 4.2 4.9 7.3H2.7v5.4h2.2l3.8 3.1V4.2Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      {enabled ? <path d="M12 6.5a5.1 5.1 0 0 1 0 7M14.6 4a8.6 8.6 0 0 1 0 12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" /> : <path d="m12.8 7.7 4.6 4.6m0-4.6-4.6 4.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />}
    </svg>
  );
}

export default function App() {
  const [input] = useState(() => new KeyboardInput());
  const snapshot = useSyncExternalStore(input.subscribe, input.getSnapshot, input.getSnapshot);
  const reducedMotion = useReducedMotion();
  const editor = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [preset, setPreset] = useState(DEFAULT_PRESET);

  const theme = {
    '--paper': preset.background,
    '--ink': preset.ui.ink,
    '--muted': preset.ui.muted,
    '--subtle': preset.ui.subtle,
    '--line': preset.ui.line,
    '--selection': preset.ui.selection,
    '--control-surface': preset.ui.controlSurface,
    '--control-active': preset.ui.controlActive,
    '--accent': preset.accent,
    '--swatch-housing': preset.housing.body.color,
    '--swatch-keycap': preset.keycaps.ivory.top.color,
    '--swatch-accent': preset.keycaps.orange.top.color,
    colorScheme: preset.id === 'dark' || preset.id === 'neon' ? 'dark' : 'light',
  } as CSSProperties;

  useEffect(() => input.connect(), [input]);

  useEffect(() => {
    const root = document.documentElement;
    const previousBackground = root.style.backgroundColor;
    const browserTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousTheme = browserTheme?.content;
    root.style.backgroundColor = preset.background;
    if (browserTheme) browserTheme.content = preset.background;
    return () => {
      root.style.backgroundColor = previousBackground;
      if (browserTheme && previousTheme !== undefined) browserTheme.content = previousTheme;
    };
  }, [preset.background]);

  useEffect(() => {
    // Focus once on desktop. Touch devices opt into their software keyboard.
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && document.activeElement === document.body) {
        editor.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const onVirtualKey = useCallback((code: string) => {
    const textarea = editor.current;
    if (!textarea || composing.current) return;
    const held = input.pressed;
    if (['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight'].some(key => held.has(key))) return;
    const definition = KEY_BY_CODE.get(code);
    const shifted = held.has('ShiftLeft') || held.has('ShiftRight');
    let insertion = shifted ? definition?.shiftCharacter ?? definition?.character : definition?.character;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;

    if (code === 'Enter') insertion = '\n';
    if (code === 'Backspace') {
      insertion = '';
      if (start === end && start > 0) start -= [...textarea.value.slice(0, start)].at(-1)!.length;
    }
    if (code === 'Delete') {
      insertion = '';
      if (start === end && end < textarea.value.length) end += String.fromCodePoint(textarea.value.codePointAt(end)!).length;
    }
    if (insertion === undefined) return;

    // Virtual typing is explicit editing; physical typing stays entirely native.
    // setRangeText keeps the current selection and never summons a mobile keyboard.
    textarea.setRangeText(insertion, start, end, 'end');
    setText(textarea.value);
    setResetMessage('');
  }, [input]);

  const reset = () => {
    setText('');
    input.releaseAll();
    setResetMessage('Text cleared.');
  };

  return (
    <div className="keyspace" style={theme} data-preset={preset.id}>
      <header className="site-header">
        <div className="wordmark" aria-label="Keyspace">
          <KeyboardMark />
          <span>KEYSPACE<span className="wordmark-period">.</span></span>
        </div>
        <div className="preset-selector" role="group" aria-label="Keyboard style">
          {PRESETS.map(option => (
            <button
              type="button"
              className="preset-button"
              key={option.id}
              aria-label={option.name}
              aria-pressed={preset.id === option.id}
              title={option.name}
              onClick={() => setPreset(option)}
            >
              <span className="preset-indicator" aria-hidden="true" />
              {option.shortName}
            </button>
          ))}
        </div>
      </header>

      <main className="playground">
        <h1 className="sr-only">An interactive mechanical keyboard</h1>
        <section className={`thoughts${focused ? ' thoughts--focused' : ''}`} aria-label="Your typing space">
          <label className="editor-label" htmlFor="typing-space">A little room for your thoughts</label>
          <div className="editor-wrap">
            <textarea
              id="typing-space"
              ref={editor}
              value={text}
              onChange={event => { setText(event.currentTarget.value); setResetMessage(''); }}
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={() => { composing.current = false; }}
              onFocus={() => setFocused(true)}
              onBlur={() => { setFocused(false); composing.current = false; }}
              placeholder="Start typing."
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              rows={2}
              aria-describedby="focus-hint"
              aria-label="Type here. Your text stays on this page."
            />
          </div>
          <label className="focus-hint" id="focus-hint" htmlFor="typing-space">
            <span className="focus-dot" aria-hidden="true" />
            {focused ? 'Ready to type' : 'Click here to type'}
          </label>
        </section>

        <div className="keyboard-stage">
          <KeyboardScene input={input} reducedMotion={reducedMotion} onVirtualKey={onVirtualKey} preset={preset} />
        </div>
      </main>

      <footer className="site-footer">
        <div className="object-caption">
          <span className="material-swatches" aria-hidden="true"><i /><i /><i /></span>
          <span>75% <span className="caption-slash">/</span> ANSI</span>
        </div>
        <p className="interaction-hint"><span className="desktop-hint">Type on your keyboard.</span><span className="mobile-hint">Make yourself at home.</span> Or try a key.</p>
        <div className="controls" aria-label="Playground controls">
          <button type="button" onClick={reset} className="control" aria-label="Reset typed text">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.2 7.2a6.2 6.2 0 1 1-.3 4.8M4.2 3.5v3.9h3.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Reset
          </button>
          <span className="control-divider" aria-hidden="true" />
          <button type="button" onClick={() => input.setSoundEnabled(!snapshot.soundEnabled)} className="control sound-control" aria-pressed={snapshot.soundEnabled} aria-label={snapshot.soundEnabled ? 'Disable keyboard sound' : 'Enable keyboard sound'}>
            <SoundIcon enabled={snapshot.soundEnabled} />
            <span>Sound <span className="sound-state">{snapshot.soundEnabled ? 'on' : 'off'}</span></span>
          </button>
        </div>
      </footer>
      <span className="sr-only" role="status" aria-live="polite">{resetMessage}</span>
    </div>
  );
}
