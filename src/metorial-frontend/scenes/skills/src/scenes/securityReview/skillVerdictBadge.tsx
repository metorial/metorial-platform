import type { SkillSecurityReview } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { isAiReviewScheduled, skillVerdicts } from './lib';

export let getSkillVerdictLabel = (review: SkillSecurityReview) =>
  isAiReviewScheduled(review) ? 'AI Review Scheduled' : skillVerdicts[review.verdict].label;

export let SkillVerdictBadge = ({
  review,
  size = '1'
}: {
  review: SkillSecurityReview;
  size?: '1' | '2';
}) => (
  <Badge color={skillVerdicts[review.verdict].color} size={size}>
    {getSkillVerdictLabel(review)}
  </Badge>
);
