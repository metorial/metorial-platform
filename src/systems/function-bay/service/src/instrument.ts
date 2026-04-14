import { setSentry } from '@lowerdeck/sentry';
import * as Sentry from '@sentry/bun';

declare global {
  // eslint-disable-next-line no-var
  var sentryInitialized: boolean | undefined;
}

if (
  process.env.METORIAL_ENV !== 'development' &&
  !global.sentryInitialized &&
  process.env.SENTRY_DSN
) {
  global.sentryInitialized = true;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    sendDefaultPii: true,

    environment: process.env.METORIAL_ENV,

    beforeSend(event) {
      if (!event.tags) event.tags = {};
      event.tags.allocationId = process.env.NOMAD_ALLOC_ID || 'unknown';
      return event;
    },

    ignoreErrors: ['The client is closed']
  });

  setSentry(Sentry as any);

  console.log('Sentry initialized for Bun');
}
