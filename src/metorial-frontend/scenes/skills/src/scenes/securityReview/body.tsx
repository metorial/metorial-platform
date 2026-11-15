import { useSecurityReviewGenerationEnabled, type UsageReviewRevision } from '@metorial/state';
import { Button } from '@metorial/ui';
import {
  SecurityReviewNotices,
  SecurityReviewProgress,
  SecurityReviewStatus,
  SecurityReviewVerdict,
  securityReviewIcons
} from './assessment';
import {
  getReviewRevisions,
  getReviewSubject,
  hasReportContent,
  isSkillReview,
  type AnySecurityReview,
  type AnySecurityReviewRevision
} from './lib';

export let isSecurityReviewUnavailable = (
  error: { data?: { status?: number; code?: string } } | null
) => {
  let wrapped = error as { error?: { data?: { status?: number; code?: string } } } | null;
  let data = error?.data ?? wrapped?.error?.data;
  return (
    data?.status == 404 ||
    data?.status == 402 ||
    data?.status == 403 ||
    data?.code == 'not_found'
  );
};

export let SecurityAssessmentBody = ({
  review,
  revision,
  detailed,
  versionLabel,
  toolCount,
  retry,
  usage
}: {
  review: AnySecurityReview;
  revision?: AnySecurityReviewRevision | null;
  detailed?: boolean;
  versionLabel?: string | null;
  toolCount?: number;
  retry?: { onClick: () => void; loading: boolean; success: boolean };
  usage?: UsageReviewRevision | null;
}) => {
  let canGenerate = useSecurityReviewGenerationEnabled();
  let { current, inProgress, failed } = getReviewRevisions<AnySecurityReviewRevision>(review);
  let shown = revision ?? current;
  let subject = getReviewSubject(review);
  let canRetry = isSkillReview(review) || review.maintainedBy == 'organization';

  if (shown && !shown.scores && !hasReportContent(shown) && shown.status == 'blocked') {
    let billing = shown.blockReason == 'billing';

    return (
      <SecurityReviewStatus
        icon={securityReviewIcons.locked}
        eyebrow={billing ? 'Review paused' : 'Deterministic checks only'}
        title={
          billing
            ? 'The AI review is blocked by your plan.'
            : shown.blockReason == 'admin_disabled'
              ? `AI review is unavailable for this ${subject}.`
              : 'AI review is disabled for this project.'
        }
        description={
          billing
            ? 'Your organization has reached its security review allowance. Upgrade your plan to resume AI reviews.'
            : shown.blockReason == 'admin_disabled'
              ? 'Only deterministic checks run for it.'
              : `This project uses reduced subprocessors. Only deterministic checks run, and ${subject} source is not sent for AI review.`
        }
      />
    );
  }

  if (shown) {
    return (
      <>
        <SecurityReviewNotices review={review} revision={shown} versionLabel={versionLabel} />
        <SecurityReviewVerdict revision={shown} detailed={detailed} usage={usage} />
      </>
    );
  }

  if (!canGenerate && canRetry) {
    return (
      <SecurityReviewStatus
        icon={securityReviewIcons.locked}
        eyebrow="No assessment available"
        title="Security reviews require a paid plan."
        description="Upgrade your plan to generate security reviews for custom providers and skills."
      />
    );
  }

  if (failed) {
    return (
      <SecurityReviewStatus
        icon={securityReviewIcons.failed}
        eyebrow="No assessment available"
        title="The review could not finish."
        description={
          subject == 'skill'
            ? 'No score was published. Retry the review to try again.'
            : 'No score was published. Retry the review once the provider is reachable.'
        }
        action={
          retry && canRetry ? (
            <Button
              size="2"
              variant="outline"
              onClick={retry.onClick}
              loading={retry.loading}
              success={retry.success}
            >
              Retry Review
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <SecurityReviewProgress revision={inProgress} toolCount={toolCount} subject={subject} />
  );
};

export let getDisplayedRevision = <R extends AnySecurityReviewRevision>(review: {
  currentRevision: R | null;
  inProgressRevision: R | null;
}) => {
  let { current, inProgress } = getReviewRevisions(review);
  return current ?? inProgress;
};
