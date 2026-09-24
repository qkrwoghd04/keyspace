import type { InputEdit, PassageChoice, Player, RaceRecord, RankingRecord, RecordPage, RunTicket } from './types';

export class ApiError extends Error { constructor(message: string, readonly status = 0) { super(message); } }
async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api${url}`, { ...init, credentials: 'same-origin', signal: controller.signal, headers: init.body ? { 'Content-Type': 'application/json' } : undefined });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(typeof data.message === 'string' ? data.message : '서버 연결 실패. 다시 시도해 주세요.', response.status);
    }
    return response.status === 204 ? undefined as T : await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('서버 연결 실패. 다시 시도해 주세요.');
  } finally { clearTimeout(timer); }
}
export const challengeApi = {
  player: () => request<{ player: Player | null }>('/player'),
  register: (nickname: string) => request<{ player: Player }>('/player', { method: 'POST', body: JSON.stringify({ nickname }) }),
  start: (choice: PassageChoice) => request<RunTicket>('/runs', { method: 'POST', body: JSON.stringify({ choice }) }),
  finish: (id: string, edits: readonly InputEdit[]) => request<RaceRecord>(`/runs/${id}/finish`, { method: 'POST', body: JSON.stringify({ edits }) }),
  cancel: (id: string) => request<void>(`/runs/${id}`, { method: 'DELETE', keepalive: true }),
  leaderboard: (choice: PassageChoice, offset = 0) => request<RecordPage<RankingRecord>>(`/leaderboard?choice=${choice}&offset=${offset}`),
  records: (choice: PassageChoice, offset = 0) => request<RecordPage>(`/records?choice=${choice}&offset=${offset}`),
  deleteRecords: () => request<void>('/records', { method: 'DELETE' }),
};
export type ChallengeApi = typeof challengeApi;
