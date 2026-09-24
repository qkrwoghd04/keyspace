import { ChallengeChannel } from './ChallengeChannel';
import { RaceEngine } from './RaceEngine';
import { PASSAGES } from './passages';
import { ApiError, challengeApi, type ChallengeApi } from './api';
import { conditionsFor, type PassageChoice, type Player, type RaceRecord, type RaceSnapshot, type RunTicket } from './types';

export interface SessionSnapshot {
  choice: PassageChoice; race: RaceSnapshot; player: Player | null;
  initializing: boolean; starting: boolean; saving: boolean; saved: boolean;
  last: RaceRecord | null; error: string; revision: number;
}
const message = (error: unknown) => error instanceof Error ? error.message : '서버 연결 실패. 다시 시도해 주세요.';

/** Owns one ticket and an in-memory, retryable submission. No localStorage writes. */
export class ChallengeSession {
  private engine = new RaceEngine(PASSAGES.korean);
  private ticket: RunTicket | null = null;
  private generation = 0;
  private submitted = false;
  private snapshot: SessionSnapshot = { choice: 'korean', race: this.engine.getSnapshot(), player: null, initializing: true, starting: false, saving: false, saved: false, last: null, error: '', revision: 0 };
  private readonly listeners = new Set<() => void>();
  constructor(private readonly channel: ChallengeChannel, readonly api: ChallengeApi = challengeApi, private readonly now: () => number = () => performance.now()) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get passage() { return PASSAGES[this.snapshot.choice]; }
  get locked() { return this.engine.locked || this.snapshot.starting; }
  private publish(patch: Partial<SessionSnapshot> = {}) {
    this.snapshot = { ...this.snapshot, ...patch, race: this.engine.getSnapshot() };
    for (const listener of this.listeners) listener();
  }
  async initialize() {
    try { const { player } = await this.api.player(); this.publish({ player, initializing: false, error: '' }); }
    catch (error) { this.publish({ initializing: false, error: message(error) }); }
  }
  configure(choice: PassageChoice) {
    if (this.locked || this.snapshot.saving) return;
    this.generation++; this.engine = new RaceEngine(PASSAGES[choice]); this.ticket = null; this.submitted = false;
    this.publish({ choice, last: null, saved: false, error: '' });
  }
  async start(nickname: string) {
    if (this.locked || this.snapshot.saving || this.snapshot.initializing) return;
    const generation = ++this.generation; this.submitted = false; this.ticket = null;
    this.engine = new RaceEngine(this.passage);
    this.channel.configure({ racing: true }); this.publish({ starting: true, last: null, saved: false, error: '' });
    try {
      if (!this.snapshot.player) {
        const { player } = await this.api.register(nickname);
        if (generation !== this.generation) return;
        this.publish({ player });
      }
      const ticket = await this.api.start(this.snapshot.choice);
      if (generation !== this.generation) { void this.api.cancel(ticket.id).catch(() => {}); return; }
      const local = conditionsFor(this.passage);
      if (Object.entries(local).some(([key, value]) => ticket.conditions[key as keyof typeof local] !== value)) {
        void this.api.cancel(ticket.id).catch(() => {});
        throw new Error('지문이 변경됨. 페이지를 새로고침해 주세요.');
      }
      this.ticket = ticket; this.engine.start(this.now()); this.publish({ starting: false });
    } catch (error) {
      if (generation !== this.generation) return;
      this.channel.configure({ racing: false }); this.publish({ starting: false, error: message(error), ...(error instanceof ApiError && error.status === 401 ? { player: null } : {}) });
    }
  }
  tick() { if (this.engine.locked) { this.engine.advance(this.now()); this.changed(); } }
  commit(value: string) { this.engine.commit(value, this.now()); this.changed(); }
  private changed() {
    this.publish();
    if (this.engine.getSnapshot().phase === 'finished' && !this.submitted) {
      this.submitted = true; this.channel.configure({ racing: false }); void this.retrySave();
    } else if (this.engine.getSnapshot().phase === 'canceled') {
      this.channel.configure({ racing: false });
      if (this.ticket) { void this.api.cancel(this.ticket.id).catch(() => {}); this.ticket = null; }
    }
  }
  cancel(reason = '경기 취소') {
    if (!this.locked) return;
    this.generation++;
    this.engine.cancel(reason);
    if (this.ticket) void this.api.cancel(this.ticket.id).catch(() => {});
    this.ticket = null; this.channel.configure({ racing: false }); this.publish({ starting: false, error: '' });
  }
  async retrySave() {
    if (!this.ticket || this.snapshot.saving || this.snapshot.saved || this.engine.getSnapshot().phase !== 'finished') return;
    const generation = this.generation, id = this.ticket.id;
    this.publish({ saving: true, error: '' });
    try {
      const last = await this.api.finish(id, this.engine.transcript);
      if (generation !== this.generation) return;
      this.engine.discardTranscript();
      this.publish({ last, saving: false, saved: true, error: '', revision: this.snapshot.revision + 1 });
    } catch (error) {
      if (generation === this.generation) this.publish({ saving: false, saved: false, error: message(error) });
    }
  }
  recordsDeleted() { this.ticket = null; this.engine.discardTranscript(); this.publish({ last: null, saved: false, revision: this.snapshot.revision + 1 }); }
}
