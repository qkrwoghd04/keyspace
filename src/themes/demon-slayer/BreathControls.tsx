import { useSyncExternalStore } from 'react';
import type { BreathController } from './BreathController';
import './breath.css';

const LABELS = { water: '물의 호흡', awakening: '각성', sun: '해의 호흡', cooling: '호흡 가다듬기' };

export default function BreathControls({ controller }: { controller: BreathController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return <section className="breath-controls" data-breath={state.phase} aria-label="Tanjiro breathing" data-keyboard-controls>
    <div className="breath-identity"><span className="breath-mark" aria-hidden="true">炭</span><div><span className="breath-eyebrow">TANJIRO <span>/</span> FLOW INTO FLAME</span><span className="breath-state" role="status" aria-live="polite">{LABELS[state.phase]}</span></div></div>
    <div className="breath-choice" role="group" aria-label="Breath mode">
      {(['auto', 'water', 'sun'] as const).map(mode => <button key={mode} type="button" aria-label={`Breath ${mode}`} aria-pressed={state.preference === mode} onClick={() => controller.select(mode)}>{mode === 'auto' ? 'Auto' : mode === 'water' ? 'Water' : 'Sun'}</button>)}
    </div>
    <div className="breath-readiness"><span className="breath-track" role="meter" aria-label="Awakening readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.charge} aria-valuetext={`${LABELS[state.phase]}, ${state.charge} percent`}><i style={{ transform: `scaleX(${state.charge / 100})` }} /></span><span>{state.preference !== 'auto' ? '수동 호흡' : state.challenge ? '정확한 타이핑으로 각성' : '끊김 없는 리듬으로 각성'}</span></div>
    <details className="breath-help"><summary aria-label="Breathing rules">?</summary><p>Auto: 최근 5초 240 CPM 이상, 25 콤보와 4초 연속 입력 유지 시 각성. Challenge는 최근 정확도 96% 이상, Playground는 정답 판정 없이 수정 비율 기준. 속도 저하 시 여유를 두고 냉각. Water와 Sun은 수동 고정.</p></details>
  </section>;
}
