import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { PASSAGES } from '../src/challenge/passages';
import { characters } from '../src/challenge/scoring';
import type { InputEdit, PassageChoice, RaceRecord, RecordPage, RunTicket } from '../src/challenge/types';

// Synthetic API clients, real 30-second races plus countdown. Use ONLY an isolated test database.
const base = process.env.LOAD_BASE_URL ?? 'http://127.0.0.1:5281';
const origin = process.env.LOAD_ORIGIN ?? base;
if (process.env.LOAD_ALLOW_TEST_DATABASE !== 'yes') throw new Error('Set LOAD_ALLOW_TEST_DATABASE=yes for an isolated test database');
const users = Number(process.env.LOAD_USERS ?? 100), duration = Number(process.env.LOAD_SECONDS ?? 600) * 1000;
if (!Number.isInteger(users) || users < 1 || users > 100 || duration < 33100) throw new Error('Invalid load parameters');
const timings = new Map<string, number[]>(), errors: string[] = [], prefix = `부하${Date.now().toString(36)}`;
let requests = 0;
async function request<T>(path: string, method = 'GET', body?: unknown, cookie?: string): Promise<{ data: T; cookie: string }> {
  const started = performance.now(), route = path.replace(/\/runs\/[^/]+\/finish/, '/runs/:id/finish').split('?')[0];
  try {
    const response = await fetch(base + '/api' + path, { method, headers: { origin, ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${text.slice(0, 120)}`);
    return { data: text ? JSON.parse(text) as T : undefined as T, cookie: (response.headers.get('set-cookie') ?? '').split(';')[0] };
  } catch (error) { errors.push(String(error)); throw error; }
  finally { requests++; const key = `${method} ${route}`; const samples = timings.get(key) ?? []; samples.push(performance.now() - started); timings.set(key, samples); }
}
const began = performance.now();
const clients = await Promise.all(Array.from({ length: users }, async (_, index) => {
  const { cookie } = await request('/player', 'POST', { nickname: `${prefix}-${index}` });
  const choice: PassageChoice = index % 2 ? 'english' : 'korean';
  const text = characters(PASSAGES[choice].text).slice(0, 180 + index * 3);
  const edits: InputEdit[] = text.map((insert, start) => ({ at: Math.floor((start + 1) * 29900 / text.length), start, deleteCount: 0, insert }));
  return { cookie, choice, edits, ids: new Set<string>() };
}));
let rounds = 0, lost = 0, duplicate = 0;
try {
  while (performance.now() - began + 33200 <= duration) {
    const tickets = await Promise.all(clients.map(async client => {
      await Promise.all([request(`/leaderboard?choice=${client.choice}`, 'GET', undefined, client.cookie), request(`/records?choice=${client.choice}`, 'GET', undefined, client.cookie)]);
      return (await request<RunTicket>('/runs', 'POST', { choice: client.choice }, client.cookie)).data;
    }));
    // A real delay: no server/client clock overrides in this capacity test.
    await delay(33100);
    const records = await Promise.all(clients.map((client, index) => request<RaceRecord>(`/runs/${tickets[index].id}/finish`, 'POST', { edits: client.edits }, client.cookie)));
    await Promise.all(clients.map(async (client, index) => {
      const result = records[index].data;
      if (client.ids.has(result.id)) duplicate++;
      client.ids.add(result.id);
      if (result.result.correct !== client.edits.length || result.result.speed !== client.edits.length / 30) throw new Error('Score mismatch');
      // Simultaneous retries must return the exact saved result and must not create another row.
      const retry = (await request<RaceRecord>(`/runs/${tickets[index].id}/finish`, 'POST', { edits: client.edits }, client.cookie)).data;
      if (!isDeepStrictEqual(retry, result)) throw new Error('Idempotency mismatch');
      const history = (await request<RecordPage>(`/records?choice=${client.choice}`, 'GET', undefined, client.cookie)).data;
      if (!history.items.some(row => row.id === result.id)) lost++;
    }));
    rounds++;
    console.log(JSON.stringify({ round: rounds, elapsedSeconds: Math.round((performance.now() - began) / 1000), records: rounds * users, errors: errors.length }));
  }
  await delay(Math.max(0, duration - (performance.now() - began)));
  await Promise.all(clients.map(async client => {
    const seen: string[] = [];
    let offset = 0, more = true;
    while (more) {
      const page = (await request<RecordPage>(`/records?choice=${client.choice}&offset=${offset}`, 'GET', undefined, client.cookie)).data;
      seen.push(...page.items.map(row => row.id)); offset += 20; more = page.hasMore;
    }
    lost += [...client.ids].filter(id => !seen.includes(id)).length;
    duplicate += seen.length - new Set(seen).size;
    if (seen.length !== rounds) throw new Error('Unexpected history count');
  }));
} catch (error) { if (!errors.includes(String(error))) errors.push(String(error)); }
const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1] ?? 0;
const all = [...timings.values()].flat();
const report = {
  at: new Date().toISOString(), base, users, requestedSeconds: duration / 1000, elapsedSeconds: (performance.now() - began) / 1000,
  rounds, expectedRecords: rounds * users, requests, lost, duplicate, errors,
  runtime: process.version, apiP95Ms: percentile(all, .95), apiMaxMs: Math.max(...all),
  endpoints: Object.fromEntries([...timings].map(([key, values]) => [key, { count: values.length, p50Ms: percentile(values, .5), p95Ms: percentile(values, .95), maxMs: Math.max(...values) }])),
  passed: errors.length === 0 && lost === 0 && duplicate === 0 && percentile(all, .95) <= 500 && rounds > 0,
};
mkdirSync('artifacts/challenge', { recursive: true });
writeFileSync('artifacts/challenge/load-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
