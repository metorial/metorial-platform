import {
  getSentry,
  getSentryServiceErrorFingerprint,
  shouldIgnoreSentryHttpError
} from '@lowerdeck/sentry';
import { initServerSentry, type ErrorEvent, type EventHint } from '@lowerdeck/sentry/server';
import { hostname } from 'node:os';
import { errorReportingSettings } from './env';

let bootFailureFlushTimeoutMs = 2_000;

let ignoredErrors = [/Response Error/, 'The client is closed'];

declare global {
  // eslint-disable-next-line no-var
  var sentryInitialized: boolean | undefined;
}

let beforeSend = (event: ErrorEvent, hint: EventHint) => {
  if (shouldIgnoreSentryHttpError(hint)) return null;

  let fingerprint = getSentryServiceErrorFingerprint(hint.originalException);
  if (fingerprint && !event.fingerprint) event.fingerprint = fingerprint;

  return event;
};

// Sentry SDKs reject DSN keys with hyphens; the error-collector reads core_api as core-api.
export let normalizeDsnKey = (dsn: string) =>
  dsn.replace(
    /^(\w+:\/\/)([^@/:]+)@/,
    (_, scheme, key) => `${scheme}${key.replaceAll('-', '_')}@`
  );

export let initErrorReporting = () => {
  let dsn = errorReportingSettings.dsn && normalizeDsnKey(errorReportingSettings.dsn);
  if (!dsn || global.sentryInitialized) return false;

  global.sentryInitialized = true;

  initServerSentry({
    dsn,
    release: process.env.METORIAL_VERSION,
    environment: process.env.METORIAL_ENV ?? 'production',
    serverName: hostname(),
    ignoreErrors: ignoredErrors,
    beforeSend
  });

  return true;
};

export let reportBootFailure = async (error: unknown, step: string) => {
  let sentry = getSentry();
  if (!sentry.isInitialized()) return;

  sentry.withScope(scope => {
    scope.setTag('boot_step', step);
    sentry.captureException(error, { mechanism: { handled: false, type: 'boot' } });
  });

  await sentry.flush(bootFailureFlushTimeoutMs);
};
