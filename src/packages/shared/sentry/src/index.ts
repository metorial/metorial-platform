import * as SentryBase from '@sentry/core';

export let setSentry = (sentry: typeof SentryBase) => {
  // @ts-ignore
  if (typeof window != 'undefined') window.__sentry = sentry;
  // @ts-ignore
  if (typeof global != 'undefined') global.__sentry = sentry;
  // @ts-ignore
  if (typeof globalThis != 'undefined') globalThis.__sentry = sentry;
};

export let getSentry = (): typeof SentryBase =>
  // @ts-ignore
  typeof window != 'undefined' && window.__sentry
    ? // @ts-ignore
      window.__sentry
    : // @ts-ignore
      typeof global != 'undefined' && global.__sentry
      ? // @ts-ignore
        global.__sentry
      : // @ts-ignore
        typeof globalThis != 'undefined' && globalThis.__sentry
        ? // @ts-ignore
          globalThis.__sentry
        : SentryBase;
