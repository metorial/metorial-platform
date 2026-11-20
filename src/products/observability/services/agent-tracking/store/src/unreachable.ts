import { getSentry } from '@lowerdeck/sentry';
import mongoose from 'mongoose';

export type StoreFailureReason =
  | 'authentication'
  | 'tls'
  | 'dns'
  | 'connection_refused'
  | 'configuration'
  | 'selection_timeout';

// The message names only the reason: the driver's own message can carry the host and, for a
// malformed URL, parts of the URL itself.
export class StoreUnreachableError extends Error {
  constructor(
    readonly reason: StoreFailureReason,
    readonly failure: unknown
  ) {
    super(`The record store cannot be reached (${reason}).`);
    this.name = 'StoreUnreachableError';
  }
}

let textOf = (error: unknown): string => {
  if (!(error instanceof Error)) return '';

  let code = (error as { code?: unknown }).code;
  return `${error.name} ${String(code ?? '')} ${error.message}`;
};

let serverErrorsOf = (error: unknown): unknown[] => {
  let servers = (error as { reason?: { servers?: Map<string, { error?: unknown }> } }).reason
    ?.servers;

  return servers instanceof Map ? [...servers.values()].map(server => server.error) : [];
};

export let storeFailureReason = (error: unknown): StoreFailureReason => {
  let texts = [textOf(error), ...serverErrorsOf(error).map(textOf)].join('\n');

  if (/authentication ?failed/i.test(texts)) return 'authentication';
  if (/ssl|tls|certificate|self[- ]signed|ERR_TLS|ERR_SSL/i.test(texts)) return 'tls';
  if (/ENOTFOUND|EAI_AGAIN|querySrv/i.test(texts)) return 'dns';
  if (/ECONNREFUSED/.test(texts)) return 'connection_refused';
  if (
    error instanceof mongoose.mongo.MongoParseError ||
    error instanceof mongoose.mongo.MongoInvalidArgumentError
  )
    return 'configuration';

  return 'selection_timeout';
};

type StoreProblem =
  | { problem: 'never_connected'; reason: StoreFailureReason }
  | { problem: 'indexes_failed'; attempts: number };

let reportIntervalMs = 60_000;

export let reportStoreProblem = (report: StoreProblem) =>
  report.problem == 'never_connected'
    ? getSentry().captureMessage('Agent tracking record store has never been reachable', {
        level: 'error',
        tags: { reason: report.reason }
      })
    : getSentry().captureMessage('Agent tracking record store indexes are not in place', {
        level: 'error',
        extra: { attempts: report.attempts }
      });

// A store that has never answered is a misconfiguration or an outage from the start, which
// nothing else surfaces: clients only see a retryable 503. It is logged as an error and reported
// at most once a minute. After a first connection, an outage is the expected kind and stays a
// warning.
export let createStoreUnreachableLog = (d: {
  hasConnected: () => boolean;
  now?: () => number;
}) => {
  let now = d.now ?? Date.now;
  let lastReportedAt = Number.NEGATIVE_INFINITY;

  return (error: unknown) => {
    let reason =
      error instanceof StoreUnreachableError ? error.reason : storeFailureReason(error);

    if (d.hasConnected()) {
      console.warn(`[agent-tracking] record store is not reachable (${reason})`);
      return;
    }

    if (now() - lastReportedAt < reportIntervalMs) return;
    lastReportedAt = now();

    console.error(
      `[agent-tracking] record store has never been reachable from this process (${reason})`
    );
    reportStoreProblem({ problem: 'never_connected', reason });
  };
};
