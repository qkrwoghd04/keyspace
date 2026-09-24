import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { KeyboardInput } from '../input/KeyboardInput';
import { editVirtualKey } from '../input/virtualEditing';
import type { ChallengeChannel } from './ChallengeChannel';
import { ChallengeSession } from './ChallengeSession';
import { CompositionGate } from './CompositionGate';
import { characters } from './scoring';
import { Records } from './Records';
import type { PassageChoice } from './types';
import './challenge.css';

export interface ChallengeHandle { virtualKey(code: string): void }
interface Props { input: KeyboardInput; channel: ChallengeChannel; enabled: boolean; themeReady: boolean; onLockChange(locked: boolean): void }
const blockedInput = (type: string) => /insertFromPaste|insertFromDrop|insertFromYank|historyUndo|historyRedo/.test(type);
declare global { interface Window { __challenge?: { state: ChallengeSession['getSnapshot']; passage(): string } } }

const Challenge = forwardRef<ChallengeHandle, Props>(function Challenge({ input, channel, enabled, themeReady, onLockChange }, ref) {
  const [session] = useState(() => new ChallengeSession(channel));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot), race = state.race;
  const editor = useRef<HTMLTextAreaElement>(null), gate = useRef(new CompositionGate()), prompt = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(''), [hint, setHint] = useState(''), [nickname, setNickname] = useState('');
  const locked = session.locked, finished = race.phase === 'finished';
  const target = useMemo(() => characters(session.passage.text), [session, state.choice]);
  const offset = Math.max(0, Math.floor(race.correct / 100) * 100 - 20), shown = target.slice(offset, offset + 240);
  const onDeleted = useCallback(() => session.recordsDeleted(), [session]);

  useEffect(() => { void session.initialize(); }, [session]);
  useEffect(() => { onLockChange(locked); }, [locked, onLockChange]);
  useEffect(() => {
    channel.configure({ enabled });
    return () => { if (session.locked) session.cancel(); channel.configure({ enabled: false, racing: false }); };
  }, [channel, enabled, session]);
  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;
    window.__challenge = { state: session.getSnapshot, passage: () => session.passage.text };
    return () => { delete window.__challenge; };
  }, [session, enabled]);
  useEffect(() => {
    if (!locked) return;
    const timer = window.setInterval(() => session.tick(), 50);
    const hidden = () => { if (document.hidden) session.cancel('탭 이탈로 취소됨.'); };
    const leave = () => session.cancel('페이지 이탈로 취소됨.');
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', leave);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', leave); };
  }, [locked, session]);
  useEffect(() => {
    if (race.phase !== 'running') { setValue(race.text); gate.current.reset(race.text); }
  }, [race.phase, race.text]);
  useEffect(() => {
    const node = editor.current;
    if (!node) return;
    const before = (event: InputEvent) => {
      if (blockedInput(event.inputType)) { event.preventDefault(); setHint('직접 입력해 주세요.'); }
    };
    node.addEventListener('beforeinput', before);
    return () => node.removeEventListener('beforeinput', before);
  }, [race.phase]);
  useLayoutEffect(() => {
    const node = prompt.current, current = node?.querySelector<HTMLElement>('[data-current="true"]');
    if (!node || !current) return;
    const outer = node.getBoundingClientRect(), inner = current.getBoundingClientRect();
    if (inner.bottom > outer.bottom - 8) node.scrollTop += inner.bottom - outer.bottom + 12;
    else if (inner.top < outer.top) node.scrollTop += inner.top - outer.top;
  }, [race.correct, offset]);
  const commit = (next: string) => { session.commit(next); setValue(session.getSnapshot().race.text); setHint(''); };
  const begin = () => {
    if (!themeReady || locked || state.saving) return;
    input.releaseAll(); gate.current.reset(); setValue(''); setHint('');
    // Mount/focus within the trusted click before the network request completes.
    flushSync(() => { void session.start(nickname); });
    editor.current?.focus({ preventScroll: true });
  };
  useImperativeHandle(ref, () => ({ virtualKey(code) {
    const node = editor.current;
    if (!enabled || !node || gate.current.composing || session.getSnapshot().race.phase !== 'running') return;
    if (editVirtualKey(node, code, input.pressed)) { const next = gate.current.input(node.value); if (next !== null) commit(next); }
  } }));
  const measured = race.uniqueCorrect + race.errors > 0;
  const result = state.last?.result ?? race;
  return <section className={`challenge challenge--${race.phase}`} aria-label="Typing challenge" data-phase={race.phase}>
    <div className="challenge-setup" data-keyboard-controls>
      <div className="challenge-identity">
        {state.player ? <span className="player-name">{state.player.nickname}</span> : <label><span className="sr-only">닉네임</span><input aria-label="닉네임" placeholder="닉네임" value={nickname} maxLength={20} disabled={locked || state.initializing} onChange={event => setNickname(event.target.value)} autoComplete="off" /></label>}
        <label><span className="sr-only">지문 언어</span><select aria-label="지문 언어" value={state.choice} disabled={locked || state.saving} onChange={event => { session.configure(event.target.value as PassageChoice); setValue(''); gate.current.reset(); setHint(''); }}><option value="korean">한국어</option><option value="english">English</option></select></label>
      </div>
      {locked ? <button type="button" className="race-cancel" onClick={() => { session.cancel(); input.releaseAll(); }}>취소</button> : <button type="button" className="race-start" disabled={!themeReady || state.initializing || state.saving || (!state.player && !nickname.trim())} onClick={begin}>{finished || race.phase === 'canceled' ? '다시 시작' : '시작'}</button>}
    </div>
    {!state.player && !locked ? <p className="nickname-note">닉네임과 최고 기록은 공개</p> : null}
    {locked || finished ? <div className="race-metrics" aria-label={finished ? 'Final result' : 'Current performance'}>
      {!finished ? <div><span>{race.phase === 'countdown' ? '시작까지' : '남은 시간'}</span><output data-testid="race-time">{state.starting ? '—' : race.phase === 'countdown' ? race.countdown : `${Math.ceil(race.remainingMs / 1000)}초`}</output></div> : null}
      <div><span>글자/초</span><output data-testid="race-speed">{result.speed.toFixed(2)}</output></div>
      <div><span>정확도</span><output data-testid="race-accuracy">{measured ? `${result.accuracy.toFixed(1)}%` : '—'}</output></div>
    </div> : null}
    {locked ? <>
      <div ref={prompt} className="race-passage" aria-label={`지문: ${shown.join('')}`}><span aria-hidden="true">{shown.map((character, index) => {
        const position = offset + index, current = position === race.correct;
        return <span key={position} data-current={current} className={position < race.correct ? 'prompt-correct' : current ? race.text.length > race.correct && !gate.current.composing ? 'prompt-current prompt-error' : 'prompt-current' : ''}>{character === ' ' && current ? '␣' : character}</span>;
      })}</span></div>
      <textarea id="challenge-input" data-keyboard-input ref={editor} value={value} readOnly={race.phase !== 'running'} aria-label="Challenge typing input" aria-describedby="challenge-hint" placeholder={race.phase === 'running' ? '위 지문을 입력' : state.starting ? '연결 중…' : race.phase === 'countdown' ? '준비' : '30초 타이핑'} rows={1} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off"
        onInput={event => {
          const native = event.nativeEvent as InputEvent;
          if (blockedInput(native.inputType ?? '')) { event.currentTarget.value = race.text; setValue(race.text); setHint('직접 입력해 주세요.'); return; }
          if (session.getSnapshot().race.phase !== 'running') { event.currentTarget.value = session.getSnapshot().race.text; return; }
          setValue(event.currentTarget.value);
          const next = gate.current.input(event.currentTarget.value, native.isComposing);
          if (next !== null) commit(next);
        }}
        onChange={() => {}}
        onCompositionStart={() => { if (session.getSnapshot().race.phase === 'running') gate.current.begin(); }}
        onCompositionEnd={event => { const next = gate.current.end(event.currentTarget.value); if (next !== null) commit(next); }}
        onPaste={event => { event.preventDefault(); setHint('직접 입력해 주세요.'); }}
        onDrop={event => { event.preventDefault(); setHint('직접 입력해 주세요.'); }}
      />
      <div className="challenge-note" id="challenge-hint" role="status">{race.phase === 'canceled' ? race.reason : hint || (race.text.length > characters(race.text).slice(0, race.correct).join('').length && !gate.current.composing ? '오타를 수정해 주세요.' : '')}</div>
    </> : finished ? <div className="race-save" role="status">{state.saving ? '저장 중…' : state.saved ? '저장 완료' : '저장되지 않음'}</div> : race.phase === 'canceled' ? <p className="challenge-note" role="status">{race.reason}</p> : null}
    {state.error ? <div className="storage-error" role="alert" data-keyboard-controls>{state.error}{finished && !state.saved ? <button type="button" disabled={state.saving} onClick={() => void session.retrySave()}>저장 재시도</button> : null}</div> : null}
    {!locked && enabled ? <Records key={state.choice} choice={state.choice} revision={state.revision} playerId={state.player?.id} onDeleted={onDeleted} /> : null}
  </section>;
});
export default Challenge;
