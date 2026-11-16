import { renderWithLoader } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import {
  skillVersionsLoader,
  useSecurityReviewGenerationEnabled,
  useSkillSecurityReview,
  useSkillSecurityReviewRevision,
  useSkillSecurityReviewRevisions,
  useSkillSecurityReviewsEnabled
} from '@metorial/state';
import { Button, Callout, confirm, Panel, RenderDate, Text, Title } from '@metorial/ui';
import { RiEyeOffLine, RiFileAddLine, RiLockLine, RiRefreshLine } from '@remixicon/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SecurityReportAside } from './aside';
import { SecurityReviewMeta, SecurityReviewStatus } from './assessment';
import {
  getDisplayedRevision,
  isSecurityReviewUnavailable,
  SecurityAssessmentBody
} from './body';
import {
  getSecurityReportContents,
  SecurityReportLayout,
  SecurityReportSections,
  SecurityReportVerdict,
  SecurityReportVerdictFooter,
  SecurityReportVerdictHeader
} from './layout';
import { getReviewRevisions } from './lib';
import { SkillVerdictBadge } from './skillVerdictBadge';

let REVISION_PARAM = 'revision';
let HISTORY_LIMIT = 5;

let SecurityPanelPage = ({
  actions,
  children
}: {
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <>
    <Panel.Header actions={actions}>
      <Panel.Title>Security Assessment</Panel.Title>
      <Panel.Description>
        What this skill makes an agent do, and whether its files can be trusted.
      </Panel.Description>
    </Panel.Header>

    <Panel.Content>{children}</Panel.Content>
  </>
);

export let SkillSecurityScene = ({
  instanceId,
  skillId,
  canWrite,
  canDismiss
}: {
  instanceId: string | null | undefined;
  skillId: string | null | undefined;
  canWrite: boolean;
  canDismiss: boolean;
}) => {
  let versions = skillVersionsLoader.use(
    instanceId && skillId ? { instanceId, skillId, limit: 1 } : null
  );
  let hasNoVersions = !!versions.data && versions.data.items.length == 0;

  let isEnabled = useSkillSecurityReviewsEnabled();
  let canGenerate = useSecurityReviewGenerationEnabled();
  let review = useSkillSecurityReview(instanceId, skillId);
  let reassess = review.useReassessMutator();
  let dismiss = review.useDismissMutator();
  let restore = review.useRestoreMutator();

  let [searchParams, setSearchParams] = useSearchParams();
  let selectedRevisionId = searchParams.get(REVISION_PARAM);

  let revisions = useSkillSecurityReviewRevisions(instanceId, skillId, {
    limit: HISTORY_LIMIT,
    order: 'desc'
  });
  let selectedRevision = useSkillSecurityReviewRevision(
    instanceId,
    skillId,
    selectedRevisionId
  );

  let currentRevisionId = review.data?.currentRevision?.id ?? null;
  let lastRevisionId = useRef<string | null | undefined>(undefined);
  let isLoaded = !!review.data;
  useEffect(() => {
    if (!isLoaded) return;
    if (lastRevisionId.current !== undefined && lastRevisionId.current != currentRevisionId)
      revisions.refetch();
    lastRevisionId.current = currentRevisionId;
  }, [isLoaded, currentRevisionId]);

  let history = revisions.data?.items ?? [];
  let displayed =
    (selectedRevisionId && selectedRevision.data) ||
    (review.data ? getDisplayedRevision(review.data) : null);

  let selectRevision = (revisionId: string) => {
    let next = new URLSearchParams(searchParams);
    if (revisionId == currentRevisionId) next.delete(REVISION_PARAM);
    else next.set(REVISION_PARAM, revisionId);
    setSearchParams(next, { replace: true });
  };

  if (!isEnabled || isSecurityReviewUnavailable(review.error)) {
    return (
      <SecurityPanelPage>
        <EmptyState
          title="Security Assessment Unavailable"
          description="Security reviews are not available for this skill."
        />
      </SecurityPanelPage>
    );
  }

  return renderWithLoader({ review })(({ review }) => {
    let { current, inProgress } = getReviewRevisions(review.data);
    let isDismissed = review.data.verdict == 'dismissed';
    let isHistorical = !!displayed && !!current && displayed.id != current.id;

    let restoreButton = (
      <Button
        size="2"
        variant="outline"
        loading={restore.isLoading}
        success={restore.isSuccess}
        onClick={() => restore.mutate(undefined)}
      >
        Restore Review
      </Button>
    );

    let headerActions = (
      <>
        <SkillVerdictBadge review={review.data} size="2" />

        {!isDismissed && canDismiss && (
          <Button
            size="2"
            variant="outline"
            iconLeft={<RiEyeOffLine />}
            disabled={reassess.isLoading}
            loading={dismiss.isLoading}
            success={dismiss.isSuccess}
            onClick={() =>
              confirm({
                title: 'Dismiss Security Review',
                description:
                  'This skill will no longer be reviewed, and its verdict will no longer hold it back. You can restore the review at any time.',
                confirmText: 'Dismiss Review',
                onConfirm: () => dismiss.mutate(undefined)
              })
            }
          >
            Dismiss Review
          </Button>
        )}

        {!isDismissed && canWrite && (
          <Button
            size="2"
            variant="outline"
            iconLeft={<RiRefreshLine />}
            disabled={!canGenerate || !!inProgress || dismiss.isLoading}
            loading={reassess.isLoading}
            success={reassess.isSuccess}
            onClick={() => reassess.mutate(undefined)}
          >
            {inProgress ? 'Reassessing' : hasNoVersions ? 'Review Now' : 'Reassess Skill'}
          </Button>
        )}
      </>
    );

    let errors = (
      <>
        <reassess.RenderError />
        <dismiss.RenderError />
        <restore.RenderError />
      </>
    );

    if (isDismissed) {
      return (
        <SecurityPanelPage actions={headerActions}>
          {errors}

          <SecurityReportVerdict id="verdict">
            <SecurityReviewStatus
              icon={<RiEyeOffLine size={28} />}
              eyebrow="Review dismissed"
              title="This skill is no longer reviewed."
              description={
                <>
                  {review.data.dismissedAt && (
                    <>
                      Dismissed <RenderDate date={review.data.dismissedAt} format="date" />
                      .{' '}
                    </>
                  )}
                  Its verdict no longer holds the skill back.
                  {canDismiss && ' Restore the review to resume assessments.'}
                </>
              }
              action={canDismiss ? restoreButton : undefined}
            />
          </SecurityReportVerdict>
        </SecurityPanelPage>
      );
    }

    if (!displayed) {
      return (
        <SecurityPanelPage actions={headerActions}>
          {errors}

          <SecurityReportVerdict id="verdict">
            <SecurityReportVerdictHeader>
              <Title as="h3" size="3" weight="strong">
                Review Progress
              </Title>
            </SecurityReportVerdictHeader>

            {hasNoVersions && !inProgress ? (
              <SecurityReviewStatus
                icon={<RiFileAddLine size={28} />}
                title="This skill has not been reviewed yet."
                description="Reviews wait a while to start for new skills."
                action={
                  canWrite ? (
                    <Button
                      size="2"
                      variant="outline"
                      iconLeft={<RiRefreshLine />}
                      loading={reassess.isLoading}
                      success={reassess.isSuccess}
                      onClick={() => reassess.mutate(undefined)}
                    >
                      Review Now
                    </Button>
                  ) : undefined
                }
              />
            ) : review.data.verdict == 'unavailable' ? (
              <SecurityReviewStatus
                icon={<RiLockLine size={28} />}
                eyebrow="Review unavailable"
                title="This skill cannot be reviewed right now."
                description="No assessment was published for this skill."
              />
            ) : (
              <SecurityAssessmentBody
                review={review.data}
                detailed
                retry={
                  canWrite
                    ? {
                        onClick: () => reassess.mutate(undefined),
                        loading: reassess.isLoading,
                        success: reassess.isSuccess
                      }
                    : undefined
                }
              />
            )}
          </SecurityReportVerdict>

          {!(hasNoVersions && !inProgress) && (
            <Text size="1" color="gray600" style={{ marginTop: 12 }}>
              You can leave this page; the report appears here when it is ready.
            </Text>
          )}
        </SecurityPanelPage>
      );
    }

    return (
      <SecurityPanelPage actions={headerActions}>
        {errors}

        {isHistorical && (
          <Callout color="gray" size="1" style={{ marginBottom: 16 }}>
            You are viewing an earlier assessment.{' '}
            <a
              href="#"
              style={{ color: 'inherit', textDecoration: 'underline' }}
              onClick={e => {
                e.preventDefault();
                if (current) selectRevision(current.id);
              }}
            >
              View the latest assessment
            </a>
            .
          </Callout>
        )}

        <SecurityReportLayout>
          <div>
            <SecurityReportVerdict id="verdict">
              <SecurityReportVerdictHeader>
                <Title as="h3" size="3" weight="strong">
                  Verdict
                </Title>
              </SecurityReportVerdictHeader>

              <SecurityAssessmentBody
                review={review.data}
                revision={displayed.id == inProgress?.id ? null : displayed}
                detailed
              />

              {displayed.status != 'queued' && displayed.status != 'running' && (
                <SecurityReportVerdictFooter>
                  <SecurityReviewMeta revision={displayed} />
                </SecurityReportVerdictFooter>
              )}
            </SecurityReportVerdict>

            <SecurityReportSections revision={displayed} />
          </div>

          <SecurityReportAside
            revision={displayed}
            contents={getSecurityReportContents(displayed)}
            history={history}
            currentRevisionId={currentRevisionId}
            selectedRevisionId={displayed.id}
            versionLabels={{}}
            onSelectRevision={selectRevision}
          />
        </SecurityReportLayout>
      </SecurityPanelPage>
    );
  });
};
