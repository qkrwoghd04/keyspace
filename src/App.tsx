import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import KeyboardScene from './components/KeyboardScene';
import ThemeCollection, { CollectionIcon } from './components/ThemeCollection';
import { KeyboardInput } from './input/KeyboardInput';
import { editVirtualKey } from './input/virtualEditing';
import { ChallengeChannel } from './challenge/ChallengeChannel';
import type { ChallengeHandle } from './challenge/Challenge';
import { DEFAULT_THEME } from './themes/registry';
import type { ThemeDefinition } from './themes/types';

const Challenge = lazy(() => import('./challenge/Challenge'));

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
  const [activeTheme, setActiveTheme] = useState(DEFAULT_THEME);
  const [requestedTheme, setRequestedTheme] = useState(DEFAULT_THEME);
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [themeError, setThemeError] = useState('');
  const [mode, setMode] = useState<'playground' | 'challenge'>('playground');
  const [raceLocked, setRaceLocked] = useState(false);
  const [challengeChannel] = useState(() => new ChallengeChannel());
  const [challengeLoaded, setChallengeLoaded] = useState(false);
  const challenge = useRef<ChallengeHandle>(null);
  const preset = activeTheme.appearance;

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
    '--swatch-housing': activeTheme.swatches[0],
    '--swatch-keycap': activeTheme.swatches[1],
    '--swatch-accent': activeTheme.swatches[2],
    colorScheme: activeTheme.colorScheme,
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
    if (mode === 'challenge') { challenge.current?.virtualKey(code); return; }
    const textarea = editor.current;
    if (!textarea || composing.current) return;
    if (!editVirtualKey(textarea, code, input.pressed)) return;
    setText(textarea.value);
    setResetMessage('');
  }, [input, mode]);

  const reset = () => {
    setText('');
    input.releaseAll();
    setResetMessage('Text cleared.');
  };

  const selectTheme = (next: ThemeDefinition) => {
    if (challengeChannel.state.racing) return;
    setThemeError('');
    setRequestedTheme(next);
    setSheetOpen(false);
  };
  const selectMode = (next: 'playground' | 'challenge') => {
    if (challengeChannel.state.racing || mode === next) return;
    input.releaseAll();
    if (next === 'challenge') setChallengeLoaded(true);
    challengeChannel.configure({ enabled: next === 'challenge' });
    setMode(next);
  };
  const themeReady = useCallback((next: ThemeDefinition) => { setActiveTheme(next); setThemeError(''); }, []);
  const themeFailed = useCallback((next: ThemeDefinition, error: unknown) => {
    console.warn(`Could not load ${next.name}`, error);
    setThemeError(`${next.name} could not load.`);
  }, []);

  return (
    <div className={`keyspace${collapsed ? ' keyspace--expanded' : ''}`} style={theme} data-preset={activeTheme.id} data-mode={mode}>
      <ThemeCollection active={activeTheme} pending={themeError ? activeTheme : requestedTheme} collapsed={collapsed} sheetOpen={sheetOpen} onCollapse={() => setCollapsed(true)} onSheetClose={() => setSheetOpen(false)} onSelect={selectTheme} disabled={raceLocked} />
      <div className="main-room">
      <header className="site-header">
        <div className="wordmark" aria-label="Keyspace">
          <KeyboardMark />
          <span>KEYSPACE<span className="wordmark-period">.</span></span>
        </div>
        <div className="theme-toolbar" data-keyboard-controls>
          <span className="current-object">{activeTheme.name}<span> / {activeTheme.material}</span></span>
          <button type="button" className="control collection-open desktop-collection-open" hidden={!collapsed} onClick={() => setCollapsed(false)} aria-label="Open collection"><CollectionIcon /><span>Collection</span></button>
          <button type="button" className="control mobile-collection-open" disabled={raceLocked} onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-expanded={sheetOpen}><CollectionIcon /><span>{activeTheme.name}</span><span aria-hidden="true">⌄</span></button>
        </div>
      </header>

      <main className={`playground${mode === 'challenge' ? ' playground--challenge' : ''}`}>
        <h1 className="sr-only">An interactive keyboard collection</h1>
        <nav className="mode-switch" aria-label="Typing mode" data-keyboard-controls><button type="button" aria-pressed={mode === 'playground'} disabled={raceLocked} onClick={() => selectMode('playground')}>Playground</button><button type="button" aria-pressed={mode === 'challenge'} disabled={raceLocked} onClick={() => selectMode('challenge')}>Challenge</button></nav>
        <section className={`thoughts${focused ? ' thoughts--focused' : ''}`} aria-label="Your typing space" hidden={mode !== 'playground'}>
          <label className="editor-label" htmlFor="typing-space">A little room for your thoughts</label>
          <div className="editor-wrap">
            <textarea
              id="typing-space"
              data-keyboard-input
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

        {challengeLoaded ? <div className="challenge-slot" hidden={mode !== 'challenge'}><Suspense fallback={<p className="challenge-loading" role="status">Challenge 준비 중…</p>}><Challenge ref={challenge} input={input} channel={challengeChannel} enabled={mode === 'challenge'} themeReady={!themeError && activeTheme.id === requestedTheme.id} onLockChange={setRaceLocked} /></Suspense></div> : null}

        <div className="keyboard-stage">
          <KeyboardScene input={input} reducedMotion={reducedMotion} onVirtualKey={onVirtualKey} theme={requestedTheme} onThemeReady={themeReady} onThemeError={themeFailed} challengeChannel={challengeChannel} />
          <div className="theme-status" role="status" aria-live="polite" data-keyboard-controls>
            {themeError ? <>{themeError}<button type="button" onClick={() => { setThemeError(''); setRequestedTheme({ ...requestedTheme }); }}>Try again</button></> : requestedTheme.id !== activeTheme.id ? `Preparing ${requestedTheme.name}…` : null}
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="object-caption">
          <span className="material-swatches" aria-hidden="true"><i /><i /><i /></span>
          <span>75% <span className="caption-slash">/</span> ANSI</span>
        </div>
        <p className="interaction-hint"><span className="desktop-hint">Type on your keyboard.</span><span className="mobile-hint">Make yourself at home.</span> Or try a key.</p>
        <div className="controls" aria-label="Playground controls" data-keyboard-controls>
          <button type="button" onClick={reset} className="control" aria-label="Reset typed text" hidden={mode !== 'playground'}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.2 7.2a6.2 6.2 0 1 1-.3 4.8M4.2 3.5v3.9h3.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Reset
          </button>
          <span className="control-divider" aria-hidden="true" hidden={mode !== 'playground'} />
          <button type="button" onClick={() => input.setSoundEnabled(!snapshot.soundEnabled)} className="control sound-control" aria-pressed={snapshot.soundEnabled} aria-label={snapshot.soundEnabled ? 'Disable keyboard sound' : 'Enable keyboard sound'}>
            <SoundIcon enabled={snapshot.soundEnabled} />
            <span>Sound <span className="sound-state">{snapshot.soundEnabled ? 'on' : 'off'}</span></span>
          </button>
          <label className="volume-control"><span className="sr-only">Master volume</span><input type="range" min="0" max="100" step="1" value={Math.round(snapshot.volume * 100)} onChange={event => input.setVolume(Number(event.currentTarget.value) / 100)} aria-label="Master volume" aria-valuetext={`${Math.round(snapshot.volume * 100)} percent`} /></label>
        </div>
      </footer>
      </div>
      <span className="sr-only" role="status" aria-live="polite">{resetMessage}</span>
    </div>
  );
}
