import type { SecurityReview, SecurityReviewRevision } from '@metorial-subspace/db';

export type SkillSecurityVerdict =
  'pass' | 'warn' | 'fail' | 'pending' | 'unavailable' | 'dismissed';

// A deterministic-only revision that wasn't blocked is waiting for its deferred AI review, so
// only a clear failure is final until the agent has run.
export let skillSecurityVerdict = (d: {
  review: Pick<SecurityReview, 'dismissedAt'>;
  current: Pick<SecurityReviewRevision, 'mode' | 'blockReason' | 'risk' | 'scores'> | null;
  inProgress: Pick<SecurityReviewRevision, 'status'> | null;
}): SkillSecurityVerdict => {
  if (d.review.dismissedAt) return 'dismissed';

  if (!d.current) return d.inProgress?.status == 'failed' ? 'unavailable' : 'pending';
  if (!d.current.risk) return 'unavailable';

  let scores = d.current.scores;
  let counts = scores?.counts.findings;
  let fails = counts
    ? counts.high > 0 || counts.critical > 0
    : d.current.risk == 'high' || d.current.risk == 'critical';
  if (fails) return 'fail';

  let awaitingAi = d.current.mode == 'deterministic' && !d.current.blockReason;
  if (awaitingAi) return 'pending';

  if (
    scores &&
    (scores.assessmentComplete === false ||
      scores.confidence == 'low' ||
      (counts && (counts.medium > 0 || counts.low > 0)))
  )
    return 'warn';

  return d.current.risk == 'moderate' ? 'warn' : 'pass';
};

// Skills without a review are absent from the map, so callers decide how to treat them.
export let getSkillSecurityVerdicts = async (d: { skillIds: string[] }) => {
  if (!d.skillIds.length) return new Map<string, SkillSecurityVerdict>();

  // Loaded lazily so modules that only request reviews never open the integrations database.
  let { db } = await import('@metorial-subspace/db');

  let reviews = await db.securityReview.findMany({
    where: {
      skillId: { in: [...new Set(d.skillIds)] },
      subjectType: 'skill_version',
      status: { not: 'deleted' }
    },
    select: {
      skillId: true,
      dismissedAt: true,
      currentRevision: { select: { mode: true, blockReason: true, risk: true, scores: true } }
    }
  });

  return new Map(
    reviews.map(review => [
      review.skillId!,
      skillSecurityVerdict({ review, current: review.currentRevision, inProgress: null })
    ])
  );
};
