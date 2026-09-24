import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';

// Test-only executable, never bundled/copied into the production image.
const directory = mkdtempSync(join(tmpdir(), 'keyspace-e2e-'));
let now = Date.now();
const { app } = await createApp({ databasePath: join(directory, 'test.sqlite'), origins: ['http://127.0.0.1:5180'], now: () => now, rateLimits: false });
app.post<{ Body: { milliseconds: number } }>('/api/__test/advance', { schema: { body: { type: 'object', required: ['milliseconds'], additionalProperties: false, properties: { milliseconds: { type: 'integer', minimum: 0, maximum: 120000 } } } } }, async request => {
  now += request.body.milliseconds; return { now };
});
await app.listen({ host: '127.0.0.1', port: 5183 });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close().then(() => rmSync(directory, { recursive: true, force: true })); });
