import type { SkillWorkspaceSecurity } from '@metorial/scene-skills';
import type { SkillSecurityReview } from '@metorial/state';
import { getDisplayedRevision } from './body';
import { bandColors, bandLabels, isRevisionRunning, type SecurityReviewFinding } from './lib';
import { getSkillVerdictLabel } from './skillVerdictBadge';

let severityRank: Record<SecurityReviewFinding['severity'], number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export let getSkillWorkspaceSecurity = (
  review: SkillSecurityReview | null | undefined
): SkillWorkspaceSecurity | null => {
  if (!review || review.verdict == 'dismissed' || review.verdict == 'unavailable') return null;

  let revision = getDisplayedRevision(review);
  let scores = revision?.scores ?? null;

  let issues = (revision?.findings ?? [])
    .filter(
      finding =>
        finding.kind == 'security' &&
        finding.change != 'resolved' &&
        finding.severity != 'info'
    )
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .map(finding => ({
      key: finding.key,
      title: finding.title,
      severity: finding.severity as 'low' | 'medium' | 'high' | 'critical'
    }));

  return {
    status: isRevisionRunning(revision) || review.verdict == 'pending' ? 'pending' : 'ready',
    score: scores?.securityScore ?? null,
    color: scores ? bandColors[scores.band] : 'gray',
    scoreLabel: scores ? bandLabels[scores.band] : null,
    verdictLabel: getSkillVerdictLabel(review),
    issues
  };
};
