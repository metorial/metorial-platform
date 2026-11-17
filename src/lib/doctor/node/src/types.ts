export let doctorProtocolVersion = 1 as const;

export let checkStatuses = ['pass', 'warn', 'fail', 'skip', 'error', 'timeout'] as const;

export let checkSeverities = ['critical', 'warning', 'info'] as const;

export let checkCategories = [
  'database',
  'cache',
  'messaging',
  'storage',
  'dependency',
  'external',
  'configuration',
  'runtime',
  'security'
] as const;

export type CheckStatus = (typeof checkStatuses)[number];

export type CheckSeverity = (typeof checkSeverities)[number];

export type CheckCategory = (typeof checkCategories)[number];

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type CheckDetails = { [key: string]: JsonValue };

export interface Resolution {
  summary: string;
  steps: string[];
  docs: string | null;
}

export interface CheckResult {
  id: string;
  title: string;
  category: CheckCategory;
  target: string | null;
  status: CheckStatus;
  severity: CheckSeverity;
  durationMs: number;
  message: string;
  resolution: Resolution | null;
  details: CheckDetails | null;
  cachedAt: string | null;
}

export interface Report {
  doctor: typeof doctorProtocolVersion;
  component: string;
  instance: string;
  releaseVersion: string | null;
  buildVersion: string | null;
  channel: string | null;
  publicUrl: string | null;
  fingerprints: Record<string, string>;
  processStartedAt: string;
  startedAt: string;
  generatedAt: string;
  durationMs: number;
  runId: string;
  cached: boolean;
  ageMs: number;
  checks: CheckResult[];
}

export let isFailing = (status: CheckStatus) =>
  status == 'fail' || status == 'error' || status == 'timeout';

export let isPassing = (status: CheckStatus) => status == 'pass' || status == 'warn';
