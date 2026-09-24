import { describe, expect, it } from 'vitest';
import { RaceEngine, characters } from './RaceEngine';
import { CompositionGate } from './CompositionGate';
import { replay } from './scoring';
import type { Passage } from './types';

const english: Passage = { id: 'test', version: 1, choice: 'english', title: 'Test', language: 'en', kind: 'prose', text: 'abcdefghijklmnopqrstuvwxy z'.repeat(20) };
function started(passage = english) { const engine = new RaceEngine(passage); engine.start(100); engine.advance(3100); return engine; }
describe('shared 30-second challenge rules', () => {
  it('uses an absolute countdown and deadline, not update count', () => {
    const engine = new RaceEngine(english); engine.start(100);
    engine.commit('a', 3099); expect(engine.getSnapshot().text).toBe('');
    engine.commit('a', 3100); engine.advance(33100);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'finished', correct: 1, elapsedMs: 30000, remainingMs: 0, speed: 1 / 30 });
  });
  it('excludes edits exactly on and after the deadline', () => {
    const engine = started(); engine.commit('a', 33099.9); engine.commit('ab', 33100); engine.commit('abc', 40000);
    expect(engine.getSnapshot().result?.correct).toBe(1); expect(engine.transcript).toHaveLength(1);
  });
  it('keeps errors when corrected and stops progress at the first wrong character', () => {
    const engine = started(); engine.commit('ax', 3200); engine.commit('axb', 3210);
    expect(engine.getSnapshot()).toMatchObject({ correct: 1, uniqueCorrect: 1, errors: 2 });
    engine.commit('a', 3220); engine.commit('ab', 3230);
    expect(engine.getSnapshot()).toMatchObject({ correct: 2, errors: 2, accuracy: 50 });
  });
  it('does not farm accuracy or speed by deleting and retyping positions', () => {
    const engine = started(); engine.commit('abc', 3200);
    for (let i = 0; i < 2000; i++) { engine.commit('ab', 3300 + i); engine.commit('abc', 3300 + i); }
    expect(engine.getSnapshot()).toMatchObject({ correct: 3, uniqueCorrect: 3, errors: 0 });
    engine.commit('abx', 5400); engine.commit('ab', 5500); engine.commit('abc', 5600);
    expect(engine.getSnapshot()).toMatchObject({ uniqueCorrect: 3, errors: 1, accuracy: 75 });
    engine.advance(33100); expect(replay(english, engine.transcript)).toEqual(engine.getSnapshot().result);
  });
  it('uses the final correct prefix after deletion', () => {
    const engine = started(); engine.commit('abcde', 4000); engine.commit('a', 4100); engine.advance(33100);
    expect(engine.getSnapshot().result).toMatchObject({ correct: 1, uniqueCorrect: 5, speed: 1 / 30, accuracy: 100 });
  });
  it('counts committed repeats, not Backspace or physical key actions', () => {
    const engine = started(); engine.commit('a', 3200); engine.commit('aa', 3250); engine.commit('aaa', 3300); engine.commit('aa', 3350);
    expect(engine.getSnapshot()).toMatchObject({ correct: 1, uniqueCorrect: 1, errors: 2 });
  });
  it('counts Korean NFC graphemes, spaces and emoji once, with the same CPS unit', () => {
    const passage: Passage = { ...english, choice: 'korean', language: 'ko', text: '한글 👩‍💻 끝' }, engine = started(passage);
    engine.commit('한글 👩‍💻', 3500); engine.advance(33100);
    expect(characters('한글 👩‍💻')).toHaveLength(4);
    expect(engine.getSnapshot().result).toMatchObject({ correct: 4, speed: 4 / 30 });
    expect(replay(passage, engine.transcript)).toEqual(engine.getSnapshot().result);
  });
  it('does not keep results or editing logs for canceled runs', () => {
    const engine = started(); engine.commit('abc', 3500); engine.cancel('hidden'); engine.advance(100000);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'canceled', result: null, reason: 'hidden' }); expect(engine.transcript).toEqual([]);
  });
  it('replays replacements and pauses identically without storing a Ghost trajectory', () => {
    const engine = started();
    for (const [text, at] of [['a', 3200], ['ab', 3900], ['a', 5100], ['abcx', 8200], ['abcd', 9000], ['abd', 9500], ['abcd', 9600]] as const) engine.commit(text, at);
    engine.advance(33100);
    expect(replay(english, engine.transcript)).toEqual(engine.getSnapshot().result);
    expect(engine.transcript.map(edit => edit.at)).toEqual([100, 800, 2000, 5100, 5900, 6400, 6500]);
  });
  it('ignores duplicate confirmed input and caps verification work', () => {
    const engine = started(); engine.commit('abcx', 3200); engine.commit('abcx', 3200);
    expect(engine.transcript).toHaveLength(1); expect(engine.getSnapshot().errors).toBe(1);
    engine.commit('x'.repeat(1025), 3300); expect(engine.getSnapshot().phase).toBe('canceled');
    expect(() => replay(english, [{ at: 30000, start: 0, deleteCount: 0, insert: 'a' }])).toThrow();
  });
});
describe('composition boundary', () => {
  it('judges completed syllables once across compositionend and final input', () => {
    const gate = new CompositionGate(); gate.begin();
    for (const value of ['ㅎ', '하', '한']) expect(gate.input(value, true)).toBeNull();
    expect(gate.end('한')).toBe('한'); expect(gate.input('한')).toBeNull(); expect(gate.input('한 ')).toBe('한 ');
  });
  it('does not judge a canceled composition', () => {
    const gate = new CompositionGate(); gate.reset('한'); gate.begin(); gate.input('한ㄱ', true); expect(gate.end('한')).toBeNull();
  });
  it('excludes unfinished composition at the deadline', () => {
    const passage: Passage = { ...english, language: 'ko', text: '한글' }, engine = started(passage);
    const gate = new CompositionGate(); gate.begin(); gate.input('하', true); engine.advance(33100);
    const value = gate.end('한'); if (value !== null) engine.commit(value, 33101);
    expect(engine.getSnapshot().result).toMatchObject({ correct: 0, errors: 0 });
  });
});
