import { getSentry } from '@lowerdeck/sentry';
import { checkEdition } from '@metorial/editions';

let maxLogLines = 40;
let maxLogLineLength = 500;
let maxDetailLength = 1000;

let ansiPattern = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export type FailureDetails = Record<string, string | number | boolean | null | undefined>;

// Tags the error collector keeps; everything else about the failure goes into `details`.
export type FailureTags = {
  integration?: string;
  error_code?: string;
  provider?: string;
  step?: string;
};

export type FailureReport = {
  type: string;
  // Group key: the failure kind first, then whatever identifies the cause, never per-run ids.
  fingerprint: string[];
  // One line saying what failed. Include the run's id: the SDK drops an event identical to the
  // one before it, which would undercount repeated failures.
  message: string;
  level?: 'error' | 'warning';
  // An exception keeps its own type and stack trace; `type` and `message` then go unused.
  error?: unknown;
  tags?: FailureTags;
  details?: FailureDetails;
  log?: string[];
};

let compactDetails = (details: FailureDetails = {}) => {
  let result: Record<string, string | number | boolean> = {};
  for (let [key, value] of Object.entries(details)) {
    if (value === undefined || value === null || value === '') continue;
    result[key] = typeof value === 'string' ? value.slice(0, maxDetailLength) : value;
  }
  return result;
};

export let logTail = (lines: (string | null | undefined)[], limit = maxLogLines) =>
  lines
    .flatMap(line => (line ?? '').split(/\r?\n/))
    .map(line => line.replace(ansiPattern, '').trimEnd())
    .filter(line => line.trim())
    .slice(-limit)
    .map(line =>
      line.length > maxLogLineLength ? `${line.slice(0, maxLogLineLength)}…` : line
    );

// Reports a failure the services handle themselves (a failed build, deployment or integration
// call) to the installation's error collector, with what support needs to find the cause. Only
// the on-prem edition reports these; elsewhere, and while error reporting is off, it does nothing.
export let reportFailure = (report: FailureReport) => {
  if (!checkEdition('on-prem')) return false;

  let sentry = getSentry();
  if (!sentry.isInitialized()) return false;

  let level = report.level ?? 'error';
  let tags = Object.fromEntries(
    Object.entries(report.tags ?? {}).filter(([, value]) => typeof value === 'string' && value)
  ) as Record<string, string>;
  let contexts: Record<string, Record<string, unknown>> = {
    details: compactDetails(report.details)
  };
  let log = logTail(report.log ?? []);
  if (log.length) contexts.log = { lines: log };

  try {
    if (report.error instanceof Error) {
      sentry.withScope(scope => {
        scope.setLevel(level);
        scope.setFingerprint(report.fingerprint);
        scope.setTags(tags);
        for (let [name, context] of Object.entries(contexts)) scope.setContext(name, context);
        sentry.captureException(report.error, {
          mechanism: { type: 'metorial.failure', handled: true }
        });
      });
      return true;
    }

    sentry.captureEvent({
      level,
      fingerprint: report.fingerprint,
      tags,
      contexts,
      exception: {
        values: [
          {
            type: report.type,
            value: report.message,
            mechanism: { type: 'metorial.failure', handled: true }
          }
        ]
      }
    });
    return true;
  } catch (error) {
    console.error('Could not report failure', error);
    return false;
  }
};
