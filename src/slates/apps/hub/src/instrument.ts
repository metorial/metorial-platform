import { setSentry } from '@lowerdeck/sentry';
import { initTelemetry } from '@lowerdeck/telemetry';
import * as Sentry from '@sentry/bun';

declare global {
  // eslint-disable-next-line no-var
  var sentryInitialized: boolean | undefined;
}

initTelemetry({
  serviceName: 'mte-slates-hub',
  allowRootSpans: false
});

if (
  process.env.METORIAL_ENV != 'development' &&
  !global.sentryInitialized &&
  process.env.SENTRY_DSN
) {
  global.sentryInitialized = true;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    sendDefaultPii: true,

    environment: process.env.METORIAL_ENV,

    beforeSend(event) {
      // Optional: add allocation ID to all events here as fallback
      if (!event.tags) event.tags = {};
      event.tags.allocationId = process.env.NOMAD_ALLOC_ID || 'unknown';
      return event;
    },

    ignoreErrors: [
      'The client is closed'

      // // Temp filter for https://metorial.sentry.io/issues/145778492
      // /invalid_provider_authentication_configuration/
    ]
  });

  setSentry(Sentry as any);

  console.log('Sentry initialized for Bun');
}
