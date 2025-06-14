import * as SentryBase from '@sentry/core';

let sentryRef = { current: SentryBase };

export let setSentry = (sentry: typeof SentryBase) => {
  sentryRef.current = sentry;
};

export let getSentry = (): typeof SentryBase => sentryRef.current;
