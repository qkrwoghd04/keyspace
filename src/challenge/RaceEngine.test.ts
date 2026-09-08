import { describe, expect, it } from 'vitest';
import { RaceEngine, characters } from './RaceEngine';
import { CompositionGate } from './CompositionGate';
import { conditionsFor, type Passage } from './types';

const english: Passage = { id: 'test', version: 1, choice: 'english', title: 'Test', language: 'en', kind: 'prose', text: 'abcdefghijklmnopqrstuvwxy z'.repeat(20) };
function started(passage = english, duration: 30 | 60 = 30) { const engine = new RaceEngine(passage, conditionsFor(passage, duration)); engine.start(100); engine.advance(3100); return engine; }

describe('render-independent challenge rules', () => {
  it('uses absolute countdown and deadline, not the number of updates', () => {
    const engine = new RaceEngine(english, conditionsFor(english, 30)); engine.start(100);
    expect(engine.commit('a', 3099)).toEqual([]); expect(engine.getSnapshot().text).toBe('');
    engine.commit('a', 3100); engine.advance(4000); engine.advance(33100);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'finished', correct: 1, elapsedMs: 30000, remainingMs: 0 });
    expect(engine.getSnapshot().result!.speed).toBe(.4);
  });
  it('rejects an edit exactly on or after the deadline and finishes once', () => {
    const engine = started(); engine.commit('a', 33099.9);
    expect(engine.commit('ab', 33100).map(event => event.type)).toEqual(['finished']);
    expect(engine.getSnapshot().correct).toBe(1);
    expect(engine.commit('abc', 33101)).toEqual([]); expect(engine.advance(90000)).toEqual([]);
  });
  it('cannot move beyond an uncorrected error and retains its history after deletion', () => {
    const engine = started(); engine.commit('ax', 3200); engine.commit('axb', 3210);
    expect(engine.getSnapshot()).toMatchObject({ correct: 1, uniqueCorrect: 1, errors: 2, combo: 0 });
    engine.commit('a', 3220); expect(engine.getSnapshot().errors).toBe(2);
    engine.commit('ab', 3230);
    expect(engine.getSnapshot()).toMatchObject({ correct: 2, errors: 2, accuracy: 50, combo: 1 });
  });
  it('does not farm score, accuracy or combo by deleting and retyping a position', () => {
    const engine = started(); engine.commit('abc', 3200); const before = engine.getSnapshot();
    for (let i = 0; i < 2000; i++) { engine.commit('ab', 3300 + i); expect(engine.commit('abc', 3300 + i)).toEqual([]); }
    expect(engine.getSnapshot()).toMatchObject({ correct: 3, uniqueCorrect: 3, combo: before.combo, maxCombo: 3, errors: 0 });
    engine.commit('abx', 5400); engine.commit('ab', 5500); engine.commit('abc', 5600);
    expect(engine.getSnapshot()).toMatchObject({ uniqueCorrect: 3, errors: 1, combo: 0, accuracy: 75 });
  });
  it('uses net correct position for speed when text is deleted', () => {
    const engine = started(); engine.commit('abcde', 4000); engine.commit('a', 4100); engine.advance(33100);
    expect(engine.getSnapshot().result).toMatchObject({ correct: 1, uniqueCorrect: 5, speed: .4, accuracy: 100 });
  });
  it('counts committed repeat input but never counts a keydown or Backspace action', () => {
    const engine = started(); engine.commit('a', 3200); engine.commit('aa', 3250); engine.commit('aaa', 3300); engine.commit('aa', 3350);
    expect(engine.getSnapshot()).toMatchObject({ correct: 1, uniqueCorrect: 1, errors: 2 });
  });
  it('counts Korean NFC graphemes, not keystrokes or UTF-16 code units', () => {
    const passage: Passage = { ...english, choice: 'korean', language: 'ko', text: '한글 👩‍💻 끝' };
    const engine = started(passage, 60); engine.commit('한글 👩‍💻', 3500); engine.advance(63100);
    expect(characters('한글 👩‍💻')).toHaveLength(4);
    expect(engine.getSnapshot().result).toMatchObject({ correct: 4, speed: 4, unit: 'CPM' });
  });
  it('does not multiply speed when a combo crosses all tiers', () => {
    const engine = started(); engine.commit(english.text.slice(0, 60), 3500); engine.advance(33100);
    expect(engine.getSnapshot()).toMatchObject({ combo: 60, tier: 3, maxCombo: 60 });
    expect(engine.getSnapshot().speed).toBe(24);
  });
  it('does not create a result for cancellation, including hidden tabs', () => {
    const engine = started(); engine.commit('abc', 3500); engine.cancel('hidden'); engine.advance(100000);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'canceled', result: null, reason: 'hidden' });
  });
  it('handles fast batched commits and records actual pauses and backward movement', () => {
    const engine = started(); engine.commit('a', 3200); engine.commit('ab', 3900); engine.commit('a', 5100); engine.commit('abc', 8200); engine.advance(33100);
    expect(engine.trajectory).toEqual([[0, 0], [100, 1], [800, 2], [2000, 1], [5100, 3], [30000, 3]]);
  });
  it('coalesces only dense replay samples, never judgment events', () => {
    const engine = started();
    for (let i = 1; i <= 200; i++) engine.commit(english.text.slice(0, i), 3100 + i / 10);
    expect(engine.getSnapshot()).toMatchObject({ correct: 200, uniqueCorrect: 200, combo: 200 });
    expect(engine.trajectory.length).toBeLessThanOrEqual(5);
  });
  it('ignores duplicate final input values and handles intermediate replacements', () => {
    const engine = started(); engine.commit('abcx', 3200); engine.commit('abcx', 3200); engine.commit('abc', 3300); engine.commit('abcd', 3400);
    expect(engine.getSnapshot()).toMatchObject({ correct: 4, uniqueCorrect: 4, errors: 1, combo: 1 });
  });
});

describe('composition boundary', () => {
  it('judges a completed syllable once across compositionend and final input', () => {
    const gate = new CompositionGate(); gate.begin();
    for (const value of ['ㅎ', '하', '한']) expect(gate.input(value, true)).toBeNull();
    expect(gate.end('한')).toBe('한'); expect(gate.input('한')).toBeNull(); expect(gate.input('한 ')).toBe('한 ');
  });
  it('canceled composition contributes neither a correct character nor an error', () => {
    const gate = new CompositionGate(); gate.reset('한'); gate.begin(); gate.input('한ㄱ', true);
    expect(gate.end('한')).toBeNull();
  });
  it('does not score an unfinished composition at the deadline', () => {
    const passage: Passage = { ...english, language: 'ko', text: '한글' }, engine = started(passage);
    const gate = new CompositionGate(); gate.begin(); expect(gate.input('하', true)).toBeNull(); engine.advance(33100);
    const value = gate.end('한'); if (value !== null) engine.commit(value, 33101);
    expect(engine.getSnapshot().result).toMatchObject({ correct: 0, errors: 0 });
  });
});
