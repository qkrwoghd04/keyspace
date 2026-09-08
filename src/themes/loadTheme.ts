import type { ThemeContext, ThemeFactory, ThemeRuntime } from './types';

type ThemeModule = { default: new (context: ThemeContext) => ThemeRuntime };

/** Keep a successful module. A failed network import needs a fresh module identity. */
export function loadTheme(importer: () => Promise<ThemeModule>): () => Promise<ThemeFactory> {
  let factory: ThemeFactory | undefined;
  let failedUrl: URL | undefined;
  let retry = 0;
  return async () => {
    if (factory) return factory;
    try {
      let module: ThemeModule;
      if (failedUrl) {
        const url = new URL(failedUrl);
        url.searchParams.set('keyspace-retry', String(++retry));
        module = await import(/* @vite-ignore */ url.href) as ThemeModule;
      } else module = await importer();
      factory = context => new module.default(context);
      return factory;
    } catch (error) {
      // Chromium exposes the failed module URL in its native import error. Limit
      // recovery to this application's own source/build modules, never other origins.
      // Other error shapes remain retryable through the original importer.
      const address = error instanceof Error ? error.message.match(/https?:\/\/[^\s"'<>]+/)?.[0] : undefined;
      if (address) {
        const url = new URL(address);
        if (url.origin === window.location.origin && (/\/src\/themes\//.test(url.pathname) || /\/assets\/[^/]+\.js$/.test(url.pathname))) failedUrl = url;
      }
      throw error;
    }
  };
}
