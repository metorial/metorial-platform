import type { CheckCategory, CheckResult, CheckSeverity, CheckStatus } from './types';

export interface ResolutionInput {
  summary: string;
  steps?: string[];
  docs?: string | null;
}

export interface CheckOutcome {
  status: CheckStatus;
  message: string;
  resolution?: ResolutionInput | null;
  details?: Record<string, unknown> | null;
}

export interface IssueInput {
  message: string;
  resolution?: ResolutionInput | null;
  details?: Record<string, unknown> | null;
}

export interface CheckContext {
  signal: AbortSignal;
  dependency: (id: string) => CheckResult | undefined;
  pass: (message?: string, details?: Record<string, unknown>) => CheckOutcome;
  warn: (input: string | IssueInput, details?: Record<string, unknown>) => CheckOutcome;
  fail: (input: string | IssueInput, details?: Record<string, unknown>) => CheckOutcome;
  skip: (reason: string, details?: Record<string, unknown>) => CheckOutcome;
}

export interface CheckDefinition {
  id: string;
  title: string;
  category: CheckCategory;
  severity: CheckSeverity;
  target?: string | null;
  timeoutMs?: number;
  minIntervalMs?: number;
  dependsOn?: string[];
  resolution?: ResolutionInput;
  run: (ctx: CheckContext) => Promise<CheckOutcome | void> | CheckOutcome | void;
}

export let checkIdPattern = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;

export let check = (definition: CheckDefinition) => definition;

let issue = (
  status: CheckStatus,
  input: string | IssueInput,
  details?: Record<string, unknown>
): CheckOutcome =>
  typeof input == 'string'
    ? { status, message: input, details: details ?? null }
    : { status, ...input, details: input.details ?? details ?? null };

export let createCheckContext = (
  signal: AbortSignal,
  dependency: (id: string) => CheckResult | undefined
) => {
  let recorded: CheckOutcome | undefined;
  let record = (outcome: CheckOutcome) => (recorded = outcome);

  let ctx: CheckContext = {
    signal,
    dependency,
    pass: (message = 'OK', details) =>
      record({ status: 'pass', message, details: details ?? null }),
    warn: (input, details) => record(issue('warn', input, details)),
    fail: (input, details) => record(issue('fail', input, details)),
    skip: (reason, details) =>
      record({ status: 'skip', message: reason, details: details ?? null })
  };

  return { ctx, recorded: () => recorded };
};
