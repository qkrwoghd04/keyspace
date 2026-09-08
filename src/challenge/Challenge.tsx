import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { KeyboardInput } from '../input/KeyboardInput';
import { editVirtualKey } from '../input/virtualEditing';
import type { ChallengeChannel } from './ChallengeChannel';
import { ChallengeSession } from './ChallengeSession';
import { CompositionGate } from './CompositionGate';
import { characters } from './RaceEngine';
import { bestRecord, ghostPosition } from './records';
import { sameConditions, type Duration, type EffectIntensity, type PassageChoice } from './types';
import './challenge.css';

export interface ChallengeHandle { virtualKey(code: string): void }
interface Props { input: KeyboardInput; channel: ChallengeChannel; enabled: boolean; themeReady: boolean; onLockChange(locked: boolean): void }
const blockedInput = (type: string) => /insertFromPaste|insertFromDrop|insertFromYank|historyUndo|historyRedo/.test(type);
const format = (value: number) => value.toFixed(1);
declare global { interface Window { __challenge?: { state: ChallengeSession['getSnapshot']; passage(): string } } }

const Challenge = forwardRef<ChallengeHandle, Props>(function Challenge({ input, channel, enabled, themeReady, onLockChange }, ref) {
  const [session] = useState(() => new ChallengeSession(channel));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot), race = state.race;
  const editor = useRef<HTMLTextAreaElement>(null), gate = useRef(new CompositionGate());
  const prompt = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(''), [hint, setHint] = useState(''), [confirmDelete, setConfirmDelete] = useState(false);
  const [intensity, setIntensity] = useState<EffectIntensity>(channel.state.intensity);
  const locked = race.phase === 'running' || race.phase === 'countdown', unit = session.passage.language === 'ko' ? 'CPM' : 'WPM';
  const target = useMemo(() => characters(session.passage.text), [session, state.choice]);
  const offset = Math.max(0, Math.floor(race.correct / 100) * 100 - 20), shown = target.slice(offset, offset + 240);
  const compatible = state.records.filter(record => sameConditions(record.conditions, session.conditions));
  const best = bestRecord(state.records, session.conditions);
  const ghost = state.ghost, ghostAt = ghost ? ghostPosition(ghost.progress, race.elapsedMs) : 0;
  const trackLength = Math.max(100, race.correct + 20, ghost?.result.uniqueCorrect ?? 0);

  useEffect(() => { onLockChange(locked); }, [locked, onLockChange]);
  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;
    window.__challenge = { state: session.getSnapshot, passage: () => session.passage.text };
    return () => { delete window.__challenge; };
  }, [session, enabled]);
  useEffect(() => {
    channel.configure({ enabled, intensity });
  }, [channel, enabled, intensity]);
  useEffect(() => () => { channel.configure({ enabled: false, racing: false }); }, [channel]);
  useEffect(() => {
    if (!locked) return;
    // Interval only asks for a repaint. RaceEngine always measures performance.now.
    const timer = window.setInterval(() => session.tick(), 50);
    const hidden = () => { if (document.hidden) session.cancel('탭이 숨겨져 경기 중단. 이 기록은 저장되지 않은 상태.'); };
    const leave = () => session.cancel('페이지를 벗어나 경기 중단.');
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
      if (blockedInput(event.inputType)) { event.preventDefault(); setHint('경쟁 기록에는 붙여넣기, 드롭과 실행 취소 사용 불가. 직접 타이핑 필요.'); }
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

  const commit = (next: string, code?: string) => {
    session.commit(next, code ?? input.getSnapshot().lastCode ?? undefined);
    setValue(session.getSnapshot().race.text); setHint('');
  };
  const begin = (ghostId?: string) => {
    if (!themeReady || locked) return;
    input.releaseAll(); gate.current.reset(); setValue(''); setHint('');
    // Result replaces the editor. Mount it before focusing inside this click.
    flushSync(() => session.start(ghostId));
    // Same trusted click preserves focus eligibility on mobile before countdown.
    editor.current?.focus({ preventScroll: true });
  };
  useImperativeHandle(ref, () => ({ virtualKey(code) {
    const node = editor.current;
    if (!enabled || !node || gate.current.composing || session.getSnapshot().race.phase !== 'running') return;
    if (editVirtualKey(node, code, input.pressed)) { const next = gate.current.input(node.value); if (next !== null) commit(next, code); }
  } }));

  const configure = (choice: PassageChoice, duration: Duration) => { session.configure(choice, duration); setValue(''); gate.current.reset(); setHint(''); };
  const measured = race.uniqueCorrect + race.errors > 0;
  const finished = race.phase === 'finished';
  const accuracy = measured ? `${format(race.accuracy)}%` : '—';
  const delta = state.last && state.previousBest ? state.last.result.speed - state.previousBest.result.speed : null;

  return <section className={`challenge challenge--${race.phase}`} aria-label="Typing challenge" data-phase={race.phase}>
    <div className="challenge-topline">
      <span className="challenge-eyebrow">{finished ? state.personalBest ? 'A NEW PERSONAL BEST' : 'A GOOD RUN' : 'A LITTLE BETTER THAN YESTERDAY'}</span>
      <label className="challenge-effects" data-keyboard-controls>콤보 효과<select aria-label="Combo effects" value={intensity} onChange={event => setIntensity(event.target.value as EffectIntensity)}><option value="full">기본</option><option value="low">약하게</option><option value="off">끄기</option></select></label>
    </div>
    <div className="challenge-setup" data-keyboard-controls>
      <fieldset disabled={locked} aria-label="Game settings">
        <label><span className="sr-only">Passage language</span><select aria-label="Passage language" value={state.choice} onChange={event => configure(event.target.value as PassageChoice, state.duration)}><option value="korean">한국어</option><option value="english">English</option><option value="code">Code / TypeScript</option></select></label>
        <div className="duration-options" aria-label="Duration">{([30, 60] as const).map(duration => <button key={duration} type="button" aria-pressed={state.duration === duration} onClick={() => configure(state.choice, duration)}>{duration}초</button>)}</div>
        <label className="ghost-choice"><span>Ghost Race</span><select aria-label="Ghost record" value={ghost?.id ?? ''} disabled={!compatible.length} onChange={event => session.chooseGhost(event.target.value)}><option value="">{compatible.length ? '혼자 도전' : '같은 조건의 기록 없음'}</option>{compatible.slice(0, 20).map(record => <option key={record.id} value={record.id}>{format(record.result.speed)} {record.result.unit} / {new Date(record.createdAt).toLocaleDateString('ko-KR')}{best?.id === record.id ? ' / 최고' : ''}</option>)}</select></label>
      </fieldset>
      {locked ? <button type="button" className="race-cancel" onClick={() => { session.cancel(); input.releaseAll(); }}>경기 취소</button> : <button type="button" className="race-start" disabled={!themeReady} onClick={() => begin()}>{finished || race.phase === 'canceled' ? '다시 도전' : '시작'}</button>}
    </div>

    <div className="race-metrics" aria-label={finished ? 'Final result' : 'Current performance'}>
      <div><span>{finished ? '완료' : '남은 시간'}</span><output data-testid="race-time">{race.phase === 'countdown' ? `${race.countdown}` : `${Math.ceil(race.remainingMs / 1000)}s`}</output></div>
      <div><span>{unit}</span><output data-testid="race-speed">{format(race.speed)}</output></div>
      <div><span>정확도</span><output data-testid="race-accuracy">{accuracy}</output></div>
      <div><span>{finished ? '최대 콤보' : '콤보'}</span><output data-testid="race-combo">{finished ? race.maxCombo : race.combo}<small>{finished ? '' : race.tier ? ` / Lv.${race.tier}` : ''}</small></output></div>
    </div>

    {!finished ? <>
      <div ref={prompt} className={`race-passage${state.choice === 'code' ? ' race-passage--code' : ''}`} aria-label={`지문: ${shown.join('')}`}><span aria-hidden="true">{shown.map((character, index) => {
        const position = offset + index, current = position === race.correct;
        return <span key={position} data-current={current} className={position < race.correct ? 'prompt-correct' : current ? race.text.length > race.correct && !gate.current.composing ? 'prompt-current prompt-error' : 'prompt-current' : ''}>{character === '\n' ? '↵\n' : character === ' ' && current ? '␣' : character}</span>;
      })}</span></div>
      <textarea id="challenge-input" data-keyboard-input ref={editor} value={value} readOnly={race.phase !== 'running'} aria-label="Challenge typing input" aria-describedby="challenge-rules challenge-hint" placeholder={race.phase === 'countdown' ? '곧 시작. 편안하게 준비.' : race.phase === 'running' ? '위 지문을 그대로 입력' : '시작 버튼으로 도전'} rows={1} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off"
        onInput={event => {
          const native = event.nativeEvent as InputEvent;
          if (blockedInput(native.inputType ?? '')) { event.currentTarget.value = race.text; setValue(race.text); setHint('붙여넣기로 기록 생성 불가. 직접 타이핑 필요.'); return; }
          if (session.getSnapshot().race.phase !== 'running') { event.currentTarget.value = session.getSnapshot().race.text; return; }
          setValue(event.currentTarget.value);
          const next = gate.current.input(event.currentTarget.value, native.isComposing);
          if (next !== null) commit(next);
        }}
        onChange={() => { /* onInput uses native inputType and IME composition state. */ }}
        onCompositionStart={() => { if (session.getSnapshot().race.phase === 'running') gate.current.begin(); }}
        onCompositionEnd={event => { const next = gate.current.end(event.currentTarget.value); if (next !== null) commit(next); }}
        onPaste={event => { event.preventDefault(); setHint('Challenge에서는 붙여넣기 불가. Playground에서는 사용 가능.'); }}
        onDrop={event => { event.preventDefault(); setHint('Challenge에서는 드롭 입력 불가.'); }}
      />
    </> : <div className="race-result" role="status">
      <p>{state.personalBest ? state.saved ? '개인 최고 기록 경신.' : '개인 최고 기록 후보.' : state.previousBest ? '다음 기록을 위한 한 걸음.' : '첫 도전 완료.'}</p>
      <span>{state.previousBest ? `직전 동일 조건 최고 ${format(state.previousBest.result.speed)} ${unit} 대비 ${delta! >= 0 ? '+' : ''}${format(delta!)} ${unit}.` : '동일 조건의 이전 최고 기록 없음.'}</span>
      <span>{race.correct} 정확한 문자 / 오타 {race.errors}회{state.saved ? ' / 이 브라우저에 저장 완료' : ' / 아직 저장되지 않음'}</span>
      <button type="button" className="ghost-again" disabled={!state.saved} onClick={() => begin(state.last!.id)} data-keyboard-controls>이 기록과 Ghost Race <span aria-hidden="true">↗</span></button>
    </div>}

    {ghost ? <div className="ghost-race" aria-label="Ghost race progress">
      <div className="ghost-caption"><span>나 <b>{race.correct}</b> / Ghost <b>{ghostAt}</b></span><span data-testid="ghost-gap">{race.correct === ghostAt ? '같은 위치' : `${Math.abs(race.correct - ghostAt)}글자 ${race.correct > ghostAt ? '앞섬' : '뒤처짐'}`}</span></div>
      <div className="race-track" role="progressbar" aria-label="My progress" aria-valuenow={race.correct} aria-valuemax={trackLength} aria-valuetext={`${race.correct}글자`}><i style={{ transform: `scaleX(${Math.min(1, race.correct / trackLength)})` }} /></div>
      <div className="race-track race-track--ghost" role="progressbar" aria-label="Ghost progress" aria-valuenow={ghostAt} aria-valuemax={trackLength} aria-valuetext={`${ghostAt}글자`}><i style={{ transform: `scaleX(${Math.min(1, ghostAt / trackLength)})` }} /></div>
    </div> : null}

    <div className="challenge-note" id="challenge-hint" role="status">{race.phase === 'countdown' ? `${race.countdown}초 뒤 시작. 입력창에 포커스된 상태.` : race.phase === 'canceled' ? race.reason : hint || (gate.current.composing ? '한글 조합 중. 확정 후 판정.' : race.text.length > characters(race.text).slice(0, race.correct).join('').length ? '오타 수정 후 다음 위치로 진행 가능.' : locked ? '정확한 한 글자씩. 탭을 벗어나면 경기 중단.' : `${session.passage.title} / v${session.passage.version} / ${target.length.toLocaleString()}자 준비됨`)}</div>

    <div className="challenge-details" data-keyboard-controls>
      <details><summary>계산과 입력 규칙</summary><p id="challenge-rules">{unit === 'CPM' ? 'CPM = 현재 정확한 완성 문자 수 ÷ 경과 분.' : 'WPM = 현재 정확한 문자 수 ÷ 5 ÷ 경과 분.'} 공백과 줄바꿈 포함. 정확도 = 정답으로 통과한 고유 위치 수 ÷ (고유 위치 수 + 누적 오타 수). 삭제는 오타가 아니며 재입력은 점수와 콤보 중복 획득 불가. 콤보 배수 없음. 지문, 버전, 종류, 시간과 규칙이 같을 때만 최고 기록 비교 및 Ghost 대결 가능.</p></details>
      <details className="browser-records"><summary>이 브라우저의 기록 <span>{compatible.length}</span></summary><div className="records-content"><p>최근 20회와 조건별 최고 기록 보관. 자유 입력의 개인 텍스트 저장 없음.</p>{compatible.length ? <ol>{compatible.slice(0, 5).map(record => <li key={record.id}><span>{format(record.result.speed)} {unit} / {format(record.result.accuracy)}%<small>{new Date(record.createdAt).toLocaleString('ko-KR')}</small></span><button type="button" disabled={locked} onClick={() => begin(record.id)}>Ghost</button></li>)}</ol> : <p>같은 조건의 완료 기록 없음. 임의의 Ghost 생성 없음.</p>}{confirmDelete ? <div className="delete-confirm"><span>모든 Challenge 기록 삭제? 복구 불가.</span><button type="button" disabled={locked} onClick={() => { session.clearRecords(); setConfirmDelete(false); }}>전체 기록 삭제 확인</button><button type="button" onClick={() => setConfirmDelete(false)}>취소</button></div> : <button type="button" disabled={locked} onClick={() => setConfirmDelete(true)}>전체 기록 삭제</button>}</div></details>
    </div>
    {state.storageError ? <div className="storage-error" role="alert" data-keyboard-controls>{state.storageError}{state.last && !state.saved ? <button type="button" onClick={() => session.retrySave()}>저장 재시도</button> : null}</div> : null}
  </section>;
});
export default Challenge;
