import { v } from '@lowerdeck/validation';
import { checkIdPattern } from './check';
import {
  checkCategories,
  checkSeverities,
  checkStatuses,
  doctorProtocolVersion,
  type CheckDetails,
  type CheckResult,
  type Report
} from './types';

let timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

let optionalString = v.optional(v.nullable(v.string()));

let timestamp = v.string({
  modifiers: [
    value =>
      timestampPattern.test(value) && !Number.isNaN(Date.parse(value))
        ? []
        : [{ code: 'invalid_timestamp', message: 'Expected an RFC 3339 timestamp' }]
  ]
});

let duration = v.number({
  modifiers: [
    v.integer(),
    value =>
      value < 0 ? [{ code: 'invalid_duration', message: 'Expected a duration >= 0' }] : []
  ]
});

let resolutionValidator = v.object({
  summary: v.string(),
  steps: v.optional(v.array(v.string())),
  docs: optionalString
});

let checkValidator = v.object({
  id: v.string({ modifiers: [v.regex(checkIdPattern)] }),
  title: v.string(),
  category: v.enumOf(checkCategories),
  target: optionalString,
  status: v.enumOf(checkStatuses),
  severity: v.enumOf(checkSeverities),
  durationMs: duration,
  message: v.string(),
  resolution: v.optional(v.nullable(resolutionValidator)),
  details: v.optional(v.nullable(v.record(v.any()))),
  cachedAt: v.optional(v.nullable(timestamp))
});

let reportValidator = v.object({
  doctor: v.literal(doctorProtocolVersion),
  component: v.string({ modifiers: [v.minLength(1)] }),
  instance: v.string({ modifiers: [v.minLength(1)] }),
  releaseVersion: optionalString,
  buildVersion: optionalString,
  channel: optionalString,
  publicUrl: optionalString,
  fingerprints: v.optional(v.record(v.string())),
  processStartedAt: timestamp,
  startedAt: timestamp,
  generatedAt: timestamp,
  durationMs: duration,
  runId: v.string({ modifiers: [v.minLength(1)] }),
  cached: v.boolean(),
  ageMs: duration,
  checks: v.array(checkValidator)
});

export class InvalidReportError extends Error {
  constructor(readonly issues: { path: string; message: string }[]) {
    super(
      `Invalid doctor report: ${issues.map(issue => `${issue.path || '<root>'}: ${issue.message}`).join('; ')}`
    );
  }
}

export let parseReport = (input: unknown): Report => {
  let parsed = reportValidator.validate(input);
  if (!parsed.success) {
    throw new InvalidReportError(
      parsed.errors.map(error => ({
        path: (error.path ?? []).join('.'),
        message: error.message
      }))
    );
  }

  let report = parsed.value;

  return {
    doctor: doctorProtocolVersion,
    component: report.component,
    instance: report.instance,
    releaseVersion: report.releaseVersion ?? null,
    buildVersion: report.buildVersion ?? null,
    channel: report.channel ?? null,
    publicUrl: report.publicUrl ?? null,
    fingerprints: report.fingerprints ?? {},
    processStartedAt: report.processStartedAt,
    startedAt: report.startedAt,
    generatedAt: report.generatedAt,
    durationMs: report.durationMs,
    runId: report.runId,
    cached: report.cached,
    ageMs: report.ageMs,
    checks: report.checks.map((item): CheckResult => ({
      id: item.id,
      title: item.title,
      category: item.category,
      target: item.target ?? null,
      status: item.status,
      severity: item.severity,
      durationMs: item.durationMs,
      message: item.message,
      resolution: item.resolution
        ? {
            summary: item.resolution.summary,
            steps: item.resolution.steps ?? [],
            docs: item.resolution.docs ?? null
          }
        : null,
      details: (item.details as CheckDetails | null | undefined) ?? null,
      cachedAt: item.cachedAt ?? null
    }))
  };
};
