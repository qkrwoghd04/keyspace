import { createApp } from './app';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.PUBLIC_ORIGIN) throw new Error('PUBLIC_ORIGIN required in production');
const { app } = await createApp({
  databasePath: process.env.DATABASE_PATH ?? 'data/keyspace.sqlite',
  origins: (process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:5180,http://localhost:5180,http://127.0.0.1:5183').split(','),
  secureCookies: production, staticRoot: production ? 'dist' : undefined, logger: true,
  trustProxy: process.env.TRUSTED_PROXIES?.split(',').map(value => value.trim()).filter(Boolean),
});
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 5183) });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
