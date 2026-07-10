import type { SkillMergeRequestErrorCode } from '@metorial-cargo/db';

let mergeErrorMessages: Record<SkillMergeRequestErrorCode, string> = {
  target_changed:
    'The target skill changed while merging. Review the outstanding choices and try again.',
  unresolved_after_refresh:
    'The target skill changed while merging. Review the outstanding choices and try again.',
  apply_failed: 'The merge could not be applied. Review the request and try again.',
  verification_failed:
    'The proposed result could not be verified. Review the request and try again.',
  enqueue_failed: 'The merge worker could not be started. Review the request and try again.',
  stale_merge_recovered: 'The merge worker did not finish. Review the request and try again.'
};

export class SkillMergeRequestMergeError extends Error {
  readonly code: SkillMergeRequestErrorCode;
  override readonly cause: unknown;

  constructor(d: { code: SkillMergeRequestErrorCode; cause?: unknown }) {
    super(mergeErrorMessages[d.code]);
    this.name = 'SkillMergeRequestMergeError';
    this.code = d.code;
    this.cause = d.cause;
  }
}

export let createSkillMergeRequestMergeError = (
  code: SkillMergeRequestErrorCode,
  cause?: unknown
) => new SkillMergeRequestMergeError({ code, cause });

export let toSkillMergeRequestMergeError = (
  error: unknown,
  fallbackCode: SkillMergeRequestErrorCode
) =>
  error instanceof SkillMergeRequestMergeError
    ? error
    : createSkillMergeRequestMergeError(fallbackCode, error);
