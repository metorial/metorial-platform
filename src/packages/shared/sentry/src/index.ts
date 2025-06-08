import * as SentryBase from '@sentry/core';

let sentryRef = { current: SentryBase };

export let setSentry = (sentry: typeof SentryBase) => {
  sentryRef.current = sentry;

  // @ts-ignore
  if (typeof window != 'undefined') window.__mte_sentry = sentry;
  // @ts-ignore
  if (typeof global != 'undefined') global.__mte_sentry = sentry;
  // @ts-ignore
  if (typeof globalThis != 'undefined') globalThis.__mte_sentry = sentry;
};

export let getSentry = (): typeof SentryBase =>
  // @ts-ignore
  typeof window != 'undefined' && window.__mte_sentry
    ? // @ts-ignore
      window.__mte_sentry
    : // @ts-ignore
      typeof global != 'undefined' && global.__mte_sentry
      ? // @ts-ignore
        global.__mte_sentry
      : // @ts-ignore
        typeof globalThis != 'undefined' && globalThis.__mte_sentry
        ? // @ts-ignore
          globalThis.__mte_sentry
        : sentryRef.current;
