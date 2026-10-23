import { ctxStorage } from '@lowerdeck/execution-context';
import { generateId } from '@lowerdeck/id';
import { getSentry } from '@lowerdeck/sentry';
import type { PoolConfig } from 'pg';

export type PrismaPgAdapterOptions = {
  environment: string | undefined;
  databaseName: string;
  role: 'primary' | 'replica';
};

export type RetryReport = {
  type: 'scheduled' | 'recovered' | 'exhausted' | 'terminated';
  attempt: number;
  nextAttempt?: number;
  maxAttempts: number;
  backoffMs?: number;
  elapsedMs: number;
  reason?: 'attempts' | 'budget' | 'non_retryable' | 'shutdown';
  error?: unknown;
};

export let getErrorDetails = (error: unknown) => {
  let seen = new Set<unknown>();
  let current = error;
  let details: { code?: string; syscall?: string } = {};

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);

    let candidate = current as { code?: unknown; syscall?: unknown; cause?: unknown };
    let code =
      typeof candidate.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(candidate.code)
        ? candidate.code
        : undefined;
    let syscall =
      typeof candidate.syscall === 'string' && /^[a-zA-Z0-9_]{1,64}$/.test(candidate.syscall)
        ? candidate.syscall
        : undefined;

    if (code) details = { code, syscall };
    if (code === 'EAI_AGAIN') return details;

    current = candidate.cause;
  }

  return details;
};

export let createRetryReporter = (config: PoolConfig, options: PrismaPgAdapterOptions) => {
  try {
    let sentry = getSentry();
    let scope = sentry.getCurrentScope().clone();
    let isolationScope = sentry.getIsolationScope().clone();
    let span = sentry.getActiveSpan();
    let execution = ctxStorage.getStore()?.context;

    let url = config.connectionString ? new URL(config.connectionString) : undefined;
    let hostname = url?.hostname || config.host || process.env.PGHOST || 'localhost';
    let port = Number(url?.port || config.port || process.env.PGPORT || 5432);
    let retryId = generateId('dbretry');
    let acquisitionStack = new Error('PostgreSQL connection acquisition').stack;
    let trace = span ? sentry.spanToTraceContext(span) : undefined;

    return (report: RetryReport) => {
      try {
        let { error, ...attempt } = report;
        let errorDetails = getErrorDetails(error);
        let context = {
          retryId,
          databaseName: options.databaseName,
          role: options.role,
          environment: options.environment,
          hostname,
          port,
          ...attempt,
          ...errorDetails,
          acquisitionStack,
          executionContextId: execution?.contextId,
          executionContextType: execution?.type,
          queue: execution?.type === 'job' ? execution.queue : undefined,
          traceparent: execution?.trace?.traceparent
        };
        let level: 'info' | 'warning' = report.type === 'recovered' ? 'info' : 'warning';

        if (options.environment === 'development') {
          let log = level === 'info' ? console.info : console.warn;
          log('PostgreSQL connection retry', context);
          return;
        }

        sentry.withIsolationScope(isolationScope.clone(), () =>
          sentry.withScope(scope.clone(), reportScope => {
            if (trace) reportScope.setContext('trace', trace);

            // The request's scope may contain SQL breadcrumbs, payloads, or trace baggage.
            reportScope.addEventProcessor((event, hint) => {
              let source = event.contexts?.trace;
              hint.attachments = [];

              return {
                ...event,
                user: undefined,
                request: undefined,
                extra: undefined,
                breadcrumbs: undefined,
                contexts: {
                  databaseConnectionRetry: context,
                  ...(source
                    ? {
                        trace: {
                          trace_id: source.trace_id,
                          span_id: source.span_id,
                          parent_span_id: source.parent_span_id,
                          op: source.op,
                          status: source.status
                        }
                      }
                    : {})
                }
              };
            });

            sentry.captureMessage(`PostgreSQL connection retry: ${report.type}`, {
              level,
              fingerprint: [
                'database.connection_retry',
                options.databaseName,
                options.role,
                errorDetails.code ?? 'unknown',
                report.type
              ],
              tags: {
                'database.retry': report.type,
                'database.name': options.databaseName,
                'database.role': options.role,
                'database.error_code': errorDetails.code ?? 'unknown'
              },
              contexts: { databaseConnectionRetry: context }
            });
          })
        );
      } catch {
        // Retry diagnostics must never affect connection acquisition.
      }
    };
  } catch {
    return (_report: RetryReport) => {};
  }
};
