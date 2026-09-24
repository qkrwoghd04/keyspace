export type PassageChoice = 'korean' | 'english';
export type RacePhase = 'ready' | 'countdown' | 'running' | 'finished' | 'canceled';
export const RULE_VERSION = 'correct-prefix-cps-v2' as const;
export const DURATION_MS = 30_000;
export const COUNTDOWN_MS = 3_000;
export const MAX_EDITS = 4096;
export const PAGE_SIZE = 20;

export interface Passage {
  id: string; version: number; choice: PassageChoice; title: string;
  language: 'ko' | 'en'; kind: 'prose'; text: string;
}
export interface RaceConditions {
  passageId: string; passageVersion: number; choice: PassageChoice; duration: 30; rule: typeof RULE_VERSION;
}
/** Grapheme offsets, not physical key codes. Held only until server verification. */
export interface InputEdit { at: number; start: number; deleteCount: number; insert: string }
export interface RaceResult {
  correct: number; uniqueCorrect: number; errors: number; accuracy: number; speed: number; elapsedMs: number;
}
export interface RaceSnapshot extends RaceResult {
  phase: RacePhase; text: string; remainingMs: number; countdown: number; reason: string; result: RaceResult | null;
}
export interface Player { id: string; nickname: string }
export interface RunTicket { id: string; conditions: RaceConditions; expiresAt: string }
export interface RaceRecord { id: string; createdAt: string; conditions: RaceConditions; result: RaceResult }
export interface RankingRecord extends RaceRecord { rank: number; nickname: string; isMe: boolean }
export interface RecordPage<T = RaceRecord> { items: T[]; hasMore: boolean }

export function conditionsFor(passage: Passage): RaceConditions {
  return { passageId: passage.id, passageVersion: passage.version, choice: passage.choice, duration: 30, rule: RULE_VERSION };
}
