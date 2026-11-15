import { isServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';

let Sentry = getSentry();

export type SkillSyncIssue = {
  issue: string;
  errorCode?: string | null;
  level?: 'error' | 'warning';
  message: string;
  error?: unknown;
  skillDestinationSyncId?: string;
  propagationId?: string;
  skillRepositoryId?: string;
  extra?: Record<string, unknown>;
};

// Grouped by issue and error code so a recurring failure is one Sentry issue, not one per sync.
// Service errors go out as messages: API processes drop 4xx service errors in beforeSend.
export let reportSkillSyncIssue = (d: SkillSyncIssue) => {
  let errorCode = d.errorCode ?? 'unknown';
  let context = {
    level: d.level ?? 'error',
    tags: {
      area: 'skill_sync',
      'skill_sync.issue': d.issue,
      'skill_sync.error_code': errorCode
    },
    extra: {
      message: d.message,
      skillDestinationSyncId: d.skillDestinationSyncId,
      propagationId: d.propagationId,
      skillRepositoryId: d.skillRepositoryId,
      ...(isServiceError(d.error) ? { serviceError: d.error.data } : {}),
      ...d.extra
    },
    fingerprint: ['skill-sync', d.issue, errorCode]
  };

  if (d.error instanceof Error && !isServiceError(d.error)) {
    Sentry.captureException(d.error, context);
  } else {
    Sentry.captureMessage(`Skill sync ${d.issue} (${errorCode}): ${d.message}`, context);
  }
};
