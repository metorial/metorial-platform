import type { SecurityReview, SecurityReviewRevision } from '@metorial/state';
import { Button } from '@metorial/ui';
import {
  SecurityReviewNotices,
  SecurityReviewProgress,
  SecurityReviewStatus,
  SecurityReviewVerdict,
  securityReviewIcons
} from './assessment';
import { getReviewRevisions, hasReportContent } from './lib';

export let isSecurityReviewNotFound = (
  error: { data?: { status?: number; code?: string } } | null
) => error?.data?.status == 404 || error?.data?.code == 'not_found';

export let SecurityAssessmentBody = ({
  review,
  revision,
  detailed,
  versionLabel,
  toolCount,
  retry
}: {
  review: SecurityReview;
  revision?: SecurityReviewRevision | null;
  detailed?: boolean;
  versionLabel?: string | null;
  toolCount?: number;
  retry?: { onClick: () => void; loading: boolean; success: boolean };
}) => {
  let { current, inProgress, failed } = getReviewRevisions(review);
  let shown = revision ?? current;

  if (shown && !shown.scores && !hasReportContent(shown) && shown.status == 'blocked') {
    let billing = shown.blockReason == 'billing';

    return (
      <SecurityReviewStatus
        icon={securityReviewIcons.locked}
        eyebrow={billing ? 'Review paused' : 'Deterministic checks only'}
        title={
          billing
            ? 'The AI review is blocked by your plan.'
            : 'AI review is disabled for this project.'
        }
        description={
          billing
            ? 'Your organization has reached its security review allowance. Upgrade your plan to resume AI reviews.'
            : 'This project uses reduced subprocessors. Only deterministic checks run, and provider source is not sent for AI review.'
        }
      />
    );
  }

  if (shown) {
    return (
      <>
        <SecurityReviewNotices review={review} revision={shown} versionLabel={versionLabel} />
        <SecurityReviewVerdict revision={shown} detailed={detailed} />
      </>
    );
  }

  if (failed) {
    return (
      <SecurityReviewStatus
        icon={securityReviewIcons.failed}
        eyebrow="No assessment available"
        title="The review could not finish."
        description="No score was published. Retry the review once the provider is reachable."
        action={
          retry && review.maintainedBy == 'organization' ? (
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

  return <SecurityReviewProgress revision={inProgress} toolCount={toolCount} />;
};

export let getDisplayedRevision = (review: SecurityReview) => {
  let { current, inProgress } = getReviewRevisions(review);
  return current ?? inProgress;
};
