export type PassageChoice = 'korean' | 'english' | 'code';
export type Duration = 30 | 60;
export type RacePhase = 'ready' | 'countdown' | 'running' | 'finished' | 'canceled';
export type EffectIntensity = 'full' | 'low' | 'off';
export const RULE_VERSION = 'correct-prefix-v1' as const;

export interface Passage {
  id: string; version: number; choice: PassageChoice; title: string;
  language: 'ko' | 'en'; kind: 'prose' | 'code'; text: string;
}
export interface RaceConditions {
  passageId: string; passageVersion: number; language: 'ko' | 'en'; kind: 'prose' | 'code';
  duration: Duration; rule: typeof RULE_VERSION;
}
export type ProgressPoint = [elapsedMs: number, correctPosition: number];
export interface RaceResult {
  correct: number; uniqueCorrect: number; errors: number; accuracy: number; speed: number;
  unit: 'WPM' | 'CPM'; maxCombo: number; elapsedMs: number;
}
export interface RaceRecord {
  id: string; createdAt: string; conditions: RaceConditions; result: RaceResult; progress: ProgressPoint[];
}
export interface RaceSnapshot {
  phase: RacePhase; text: string; correct: number; uniqueCorrect: number; errors: number;
  combo: number; maxCombo: number; tier: number; accuracy: number; speed: number;
  elapsedMs: number; remainingMs: number; countdown: number; reason: string; result: RaceResult | null;
}
export type JudgmentEvent =
  | { type: 'correct'; count: number; position: number; combo: number; tier: number; code?: string }
  | { type: 'error'; count: number; position: number }
  | { type: 'combo'; value: number; tier: number }
  | { type: 'finished'; result: RaceResult; personalBest?: boolean }
  | { type: 'reset' };

export function conditionsFor(passage: Passage, duration: Duration): RaceConditions {
  return { passageId: passage.id, passageVersion: passage.version, language: passage.language, kind: passage.kind, duration, rule: RULE_VERSION };
}
export function conditionKey(value: RaceConditions) {
  return JSON.stringify([value.passageId, value.passageVersion, value.language, value.kind, value.duration, value.rule]);
}
export const sameConditions = (a: RaceConditions, b: RaceConditions) => conditionKey(a) === conditionKey(b);
export const comboTier = (combo: number) => combo >= 50 ? 3 : combo >= 25 ? 2 : combo >= 10 ? 1 : 0;
