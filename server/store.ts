import Database from 'better-sqlite3';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PASSAGES } from '../src/challenge/passages';
import { replay } from '../src/challenge/scoring';
import { COUNTDOWN_MS, DURATION_MS, PAGE_SIZE, RULE_VERSION, conditionsFor, type InputEdit, type PassageChoice, type Player, type RaceRecord, type RankingRecord, type RecordPage, type RunTicket } from '../src/challenge/types';

export class HttpError extends Error { constructor(readonly statusCode: number, message: string) { super(message); } }
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
interface RunRow { id: string; playerId: string; choice: PassageChoice; passageId: string; passageVersion: number; rule: typeof RULE_VERSION; issuedAt: number; expiresAt: number; state: 'pending' | 'finished' | 'canceled' }
interface RecordRow extends RunRow { createdAt: number; correct: number; uniqueCorrect: number; errors: number; accuracy: number; speed: number; nickname?: string }
const record = (row: RecordRow): RaceRecord => ({
  id: row.id, createdAt: new Date(row.createdAt).toISOString(),
  conditions: { choice: row.choice, passageId: row.passageId, passageVersion: row.passageVersion, rule: row.rule, duration: 30 },
  result: { correct: row.correct, uniqueCorrect: row.uniqueCorrect, errors: row.errors, accuracy: row.accuracy, speed: row.speed, elapsedMs: DURATION_MS },
});

export class RecordStore {
  readonly db: Database.Database;
  private readonly statements = new Map<string, Database.Statement>();
  private readonly boards = new Map<string, { at: number; rows: RecordRow[] }>();
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    const version = (this.db.prepare('SELECT sqlite_version() AS version').get() as { version: string }).version.split('.').map(Number);
    if (version[0] < 3 || (version[0] === 3 && (version[1] < 51 || (version[1] === 51 && version[2] < 3)))) { this.db.close(); throw new Error('SQLite >= 3.51.3 required'); }
    this.db.pragma('journal_mode = WAL'); this.db.pragma('synchronous = FULL');
    this.db.pragma('foreign_keys = ON'); this.db.pragma('busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, tokenHash TEXT NOT NULL UNIQUE, nickname TEXT NOT NULL, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY, playerId TEXT NOT NULL REFERENCES players(id), choice TEXT NOT NULL CHECK(choice IN ('korean','english')),
        passageId TEXT NOT NULL, passageVersion INTEGER NOT NULL, rule TEXT NOT NULL,
        issuedAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','finished','canceled'))
      );
      CREATE INDEX IF NOT EXISTS runs_player ON runs(playerId, state);
      CREATE INDEX IF NOT EXISTS runs_expiry ON runs(expiresAt);
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY REFERENCES runs(id), playerId TEXT NOT NULL REFERENCES players(id), choice TEXT NOT NULL,
        passageId TEXT NOT NULL, passageVersion INTEGER NOT NULL, rule TEXT NOT NULL, createdAt INTEGER NOT NULL,
        correct INTEGER NOT NULL, uniqueCorrect INTEGER NOT NULL, errors INTEGER NOT NULL, accuracy REAL NOT NULL, speed REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS records_history ON records(playerId, choice, createdAt DESC, id DESC);
      CREATE INDEX IF NOT EXISTS records_rank ON records(choice, passageId, passageVersion, rule, playerId, correct DESC, accuracy DESC, createdAt, id);
      PRAGMA user_version = 1;
    `);
  }
  private stmt(sql: string) { let statement = this.statements.get(sql); if (!statement) { statement = this.db.prepare(sql); this.statements.set(sql, statement); } return statement; }
  player(token?: string): Player | null {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return this.stmt('SELECT id, nickname FROM players WHERE tokenHash = ?').get(tokenHash(token)) as Player ?? null;
  }
  createPlayer(nickname: string, now: number) {
    const player = { id: randomUUID(), nickname }, token = randomBytes(32).toString('hex');
    this.stmt('INSERT INTO players VALUES (?, ?, ?, ?)').run(player.id, tokenHash(token), nickname, now);
    return { player, token };
  }
  start(playerId: string, choice: PassageChoice, now: number): RunTicket {
    const id = randomUUID(), conditions = conditionsFor(PASSAGES[choice]), expiresAt = now + COUNTDOWN_MS + DURATION_MS + 600_000;
    this.db.transaction(() => {
      this.stmt("UPDATE runs SET state = 'canceled' WHERE playerId = ? AND state = 'pending'").run(playerId);
      this.stmt("INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')").run(id, playerId, choice, conditions.passageId, conditions.passageVersion, conditions.rule, now, expiresAt);
    }).immediate();
    return { id, conditions, expiresAt: new Date(expiresAt).toISOString() };
  }
  finish(id: string, playerId: string, edits: InputEdit[], now: number): RaceRecord {
    const saved = this.db.transaction(() => {
      const run = this.stmt('SELECT * FROM runs WHERE id = ? AND playerId = ?').get(id, playerId) as RunRow | undefined;
      if (!run) throw new HttpError(404, '경기를 찾을 수 없음.');
      if (run.state === 'finished') return record(this.stmt('SELECT * FROM records WHERE id = ?').get(id) as RecordRow);
      if (run.state !== 'pending' || now > run.expiresAt) throw new HttpError(410, '취소되었거나 저장 시간이 지난 경기.');
      if (now < run.issuedAt + COUNTDOWN_MS + DURATION_MS) throw new HttpError(409, '아직 경기가 끝나지 않음. 잠시 후 재시도해 주세요.');
      const passage = PASSAGES[run.choice];
      if (run.passageId !== passage.id || run.passageVersion !== passage.version || run.rule !== RULE_VERSION) throw new HttpError(409, '경기 규칙이 변경됨. 새로 시작해 주세요.');
      let result;
      try { result = replay(passage, edits); } catch { throw new HttpError(400, '입력 기록을 확인할 수 없음.'); }
      this.stmt('INSERT INTO records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, playerId, run.choice, run.passageId, run.passageVersion, run.rule, now, result.correct, result.uniqueCorrect, result.errors, result.accuracy, result.speed);
      this.stmt("UPDATE runs SET state = 'finished' WHERE id = ?").run(id);
      return { id, createdAt: new Date(now).toISOString(), conditions: conditionsFor(passage), result };
    }).immediate();
    this.boards.clear(); return saved;
  }
  cancel(id: string, playerId: string) {
    this.stmt("UPDATE runs SET state = 'canceled' WHERE id = ? AND playerId = ? AND state = 'pending'").run(id, playerId);
  }
  history(playerId: string, choice: PassageChoice, offset: number): RecordPage {
    const rows = this.stmt('SELECT * FROM records WHERE playerId = ? AND choice = ? ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?').all(playerId, choice, PAGE_SIZE + 1, offset) as RecordRow[];
    return { items: rows.slice(0, PAGE_SIZE).map(record), hasMore: rows.length > PAGE_SIZE };
  }
  leaderboard(choice: PassageChoice, offset: number, viewer: string | undefined, now: number): RecordPage<RankingRecord> {
    const passage = PASSAGES[choice], key = `${choice}:${offset}`, cached = this.boards.get(key);
    let rows = cached && now - cached.at < 2000 ? cached.rows : undefined;
    if (!rows) {
      rows = this.stmt(`WITH personal AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY playerId ORDER BY correct DESC, accuracy DESC, createdAt, id) AS best
        FROM records WHERE choice = ? AND passageId = ? AND passageVersion = ? AND rule = ? AND correct > 0
      ) SELECT personal.*, players.nickname FROM personal JOIN players ON players.id = personal.playerId
        WHERE best = 1 ORDER BY correct DESC, accuracy DESC, personal.createdAt, personal.id LIMIT ? OFFSET ?`).all(choice, passage.id, passage.version, RULE_VERSION, PAGE_SIZE + 1, offset) as RecordRow[];
      if (this.boards.size >= 64) this.boards.clear(); this.boards.set(key, { at: now, rows });
    }
    return { items: rows.slice(0, PAGE_SIZE).map((row, i) => ({ ...record(row), nickname: row.nickname!, rank: offset + i + 1, isMe: row.playerId === viewer })), hasMore: rows.length > PAGE_SIZE };
  }
  deleteHistory(playerId: string) {
    this.db.transaction(() => { this.stmt('DELETE FROM records WHERE playerId = ?').run(playerId); this.stmt('DELETE FROM runs WHERE playerId = ?').run(playerId); }).immediate();
    this.boards.clear();
  }
  cleanup(now: number) { this.stmt("DELETE FROM runs WHERE expiresAt < ? AND state <> 'finished'").run(now); }
  close() { this.db.close(); }
}
