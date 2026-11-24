import * as Sentry from '@sentry/core';
import { nodeStackLineParser, ServerRuntimeClient } from '@sentry/core/server';
import { setSentry } from './index';

export type { ErrorEvent, EventHint } from '@sentry/core';

export type ServerSentryOptions = {
  dsn: string;
  release?: string;
  environment?: string;
  serverName?: string;
  ignoreErrors?: (string | RegExp)[];
  beforeSend?: (event: Sentry.ErrorEvent, hint: Sentry.EventHint) => Sentry.ErrorEvent | null;
  requestTimeoutMs?: number;
};

let defaultRequestTimeoutMs = 5_000;

let fetchTransport = (timeoutMs: number) => (options: Sentry.BaseTransportOptions) =>
  Sentry.createTransport(options, async request => {
    let response = await fetch(options.url, {
      method: 'POST',
      body: request.body as RequestInit['body'],
      headers: options.headers,
      signal: AbortSignal.timeout(timeoutMs)
    });

    return {
      statusCode: response.status,
      headers: {
        'x-sentry-rate-limits': response.headers.get('X-Sentry-Rate-Limits'),
        'retry-after': response.headers.get('Retry-After')
      }
    };
  });

// A Sentry client built only from @sentry/core, for bundles that must not contain
// @sentry/bun or @sentry/node (on-prem). It captures what the code reports explicitly
// and does not instrument the runtime.
export let initServerSentry = (options: ServerSentryOptions) => {
  let client = new ServerRuntimeClient({
    dsn: options.dsn,
    release: options.release,
    environment: options.environment,
    serverName: options.serverName,
    platform: 'node',
    runtime: process.versions.bun
      ? { name: 'bun', version: process.versions.bun }
      : { name: 'node', version: process.versions.node },
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    ignoreErrors: options.ignoreErrors,
    beforeSend: options.beforeSend,
    stackParser: Sentry.createStackParser(nodeStackLineParser()),
    transport: fetchTransport(options.requestTimeoutMs ?? defaultRequestTimeoutMs),
    integrations: [
      Sentry.eventFiltersIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration()
    ]
  });

  Sentry.setCurrentClient(client);
  client.init();
  setSentry(Sentry);

  return client;
};
