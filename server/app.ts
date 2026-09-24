import Fastify, { type FastifyContextConfig, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { resolve } from 'node:path';
import { HttpError, RecordStore, tokenHash } from './store';
import { MAX_EDITS, type InputEdit, type PassageChoice } from '../src/challenge/types';
import { characters } from '../src/challenge/scoring';

const COOKIE = 'keyspace_player';
const choiceSchema = { type: 'string', enum: ['korean', 'english'] };
const pageSchema = { type: 'object', additionalProperties: false, properties: { choice: choiceSchema, offset: { type: 'integer', minimum: 0, maximum: 100_000, default: 0 } }, required: ['choice'] };
const idSchema = { type: 'object', additionalProperties: false, properties: { id: { type: 'string', pattern: '^[a-f0-9-]{36}$' } }, required: ['id'] };
export interface AppOptions { databasePath: string; origins: string[]; secureCookies?: boolean; staticRoot?: string; now?: () => number; logger?: boolean; trustProxy?: string[]; rateLimits?: boolean }

export async function createApp(options: AppOptions) {
  const now = options.now ?? Date.now, store = new RecordStore(options.databasePath);
  // Never log cookies, bodies or query strings containing input data.
  const app = Fastify({ logger: options.logger ? { serializers: { req: req => ({ method: req.method, url: req.url?.split('?')[0] }) }, redact: ['req.headers.cookie', 'res.headers.set-cookie'] } : false, bodyLimit: 262_144, trustProxy: options.trustProxy ?? false, ajv: { customOptions: { removeAdditional: false } } });
  await app.register(cookie);
  await app.register(rateLimit, { global: options.rateLimits !== false, max: 6000, timeWindow: 60_000, cache: 10_000, errorResponseBuilder: () => ({ statusCode: 429, message: '요청이 많음. 잠시 후 다시 시도해 주세요.' }) });
  const player = (request: FastifyRequest) => store.player(request.cookies[COOKIE]);
  const requirePlayer = (request: FastifyRequest) => { const current = player(request); if (!current) throw new HttpError(401, '닉네임을 다시 등록해 주세요.'); return current; };
  const playerKey = (request: FastifyRequest) => tokenHash(request.cookies[COOKIE] ?? request.ip);
  const limited = (max: number): FastifyContextConfig => options.rateLimits === false ? { rateLimit: false } : { rateLimit: { max, timeWindow: 60_000, keyGenerator: playerKey } };
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff'); reply.header('Referrer-Policy', 'same-origin');
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD' && !options.origins.includes(request.headers.origin ?? '')) throw new HttpError(403, '허용되지 않은 요청.');
  });
  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof HttpError;
    const failure = error && typeof error === 'object' ? error as { statusCode?: number; code?: string } : {};
    const status = known ? error.statusCode : typeof failure.statusCode === 'number' && failure.statusCode >= 400 && failure.statusCode < 500 ? failure.statusCode : 500;
    if (status >= 500) request.log.error({ code: failure.code ?? 'SERVER_ERROR' }, 'Request failed');
    reply.code(status).send({ message: known ? error.message : status === 429 ? '요청이 많음. 잠시 후 다시 시도해 주세요.' : status < 500 ? '요청 형식을 확인해 주세요.' : '서버 연결 실패. 잠시 후 다시 시도해 주세요.' });
  });
  app.get('/api/health', () => { store.db.prepare('SELECT 1').get(); return { ok: true }; });
  app.get('/api/player', request => ({ player: player(request) }));
  app.post<{ Body: { nickname: string } }>('/api/player', {
    config: options.rateLimits === false ? { rateLimit: false } : { rateLimit: { max: 120, timeWindow: 3_600_000 } },
    schema: { body: { type: 'object', additionalProperties: false, required: ['nickname'], properties: { nickname: { type: 'string', minLength: 1, maxLength: 80 } } } },
  }, (request, reply) => {
    const existing = player(request); if (existing) return { player: existing };
    const nickname = request.body.nickname.normalize('NFC').trim();
    if (characters(nickname).length < 1 || characters(nickname).length > 20 || /[\p{C}<>]/u.test(nickname)) throw new HttpError(400, '닉네임은 1~20글자로 입력해 주세요.');
    const created = store.createPlayer(nickname, now());
    reply.setCookie(COOKIE, created.token, { path: '/api', httpOnly: true, secure: options.secureCookies ?? false, sameSite: 'lax', maxAge: 31_536_000 });
    return { player: created.player };
  });
  app.post<{ Body: { choice: PassageChoice } }>('/api/runs', {
    config: limited(6), schema: { body: { type: 'object', additionalProperties: false, required: ['choice'], properties: { choice: choiceSchema } } },
  }, request => store.start(requirePlayer(request).id, request.body.choice, now()));
  app.post<{ Params: { id: string }; Body: { edits: InputEdit[] } }>('/api/runs/:id/finish', {
    config: limited(12), schema: { params: idSchema, body: {
      type: 'object', additionalProperties: false, required: ['edits'], properties: { edits: { type: 'array', maxItems: MAX_EDITS, items: {
        type: 'object', additionalProperties: false, required: ['at', 'start', 'deleteCount', 'insert'], properties: {
          at: { type: 'integer', minimum: 0, maximum: 29_999 }, start: { type: 'integer', minimum: 0, maximum: 20_000 }, deleteCount: { type: 'integer', minimum: 0, maximum: 20_000 }, insert: { type: 'string', maxLength: 1024 },
        },
      } } },
    } },
  }, request => store.finish(request.params.id, requirePlayer(request).id, request.body.edits, now()));
  app.delete<{ Params: { id: string } }>('/api/runs/:id', { config: limited(12), schema: { params: idSchema } }, (request, reply) => { store.cancel(request.params.id, requirePlayer(request).id); reply.code(204).send(); });
  app.get<{ Querystring: { choice: PassageChoice; offset: number } }>('/api/leaderboard', { schema: { querystring: pageSchema } }, request => store.leaderboard(request.query.choice, request.query.offset, player(request)?.id, now()));
  app.get<{ Querystring: { choice: PassageChoice; offset: number } }>('/api/records', { schema: { querystring: pageSchema } }, request => store.history(requirePlayer(request).id, request.query.choice, request.query.offset));
  app.delete('/api/records', { config: limited(3) }, (request, reply) => { store.deleteHistory(requirePlayer(request).id); reply.code(204).send(); });
  if (options.staticRoot) {
    await app.register(staticFiles, { root: resolve(options.staticRoot), setHeaders(reply, path) { reply.header('Cache-Control', /[/\\]assets[/\\]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache'); } });
    app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? reply.code(404).send({ message: '요청 경로를 찾을 수 없음.' }) : reply.code(404).send('Not found'));
  }
  const cleanup = setInterval(() => { try { store.cleanup(now()); } catch { app.log.error('Expired run cleanup failed'); } }, 3_600_000); cleanup.unref();
  app.addHook('onClose', () => { clearInterval(cleanup); store.close(); });
  return { app, store };
}
