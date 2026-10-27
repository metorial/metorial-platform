import { renderWithLoader } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import {
  skillVersionsLoader,
  useCurrentInstance,
  useSkill,
  useSkillSecurityReview,
  useSkillSecurityReviewRevision,
  useSkillSecurityReviewRevisions,
  useSkillSecurityReviewsEnabled,
  useStorePermissions
} from '@metorial/state';
import { Button, Callout, confirm, RenderDate, Text, Title } from '@metorial/ui';
import { RiEyeOffLine, RiFileAddLine, RiLockLine, RiRefreshLine } from '@remixicon/react';
import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  getDisplayedRevision,
  getReviewRevisions,
  getSecurityReportContents,
  isSecurityReviewNotFound,
  SecurityAssessmentBody,
  SecurityReportAside,
  SecurityReportHeader,
  SecurityReportHeaderActions,
  SecurityReportLayout,
  SecurityReportSections,
  SecurityReportVerdict,
  SecurityReportVerdictFooter,
  SecurityReportVerdictHeader,
  SecurityReviewMeta,
  SecurityReviewStatus,
  SkillVerdictBadge
} from '../../../scenes/securityReview';

let REVISION_PARAM = 'revision';
let HISTORY_LIMIT = 5;

export let SkillSecurityPage = () => {
  let instance = useCurrentInstance();
  let { skillId } = useParams();
  let skill = useSkill(instance.data?.id, skillId);
  let storePermissions = useStorePermissions(instance.data?.id, skill.data?.storeId);
  let canWriteSkill =
    storePermissions.data?.hasFullAccess ||
    storePermissions.data?.permissions.includes('content_write');

  let versions = skillVersionsLoader.use(
    instance.data?.id && skill.data?.id
      ? { instanceId: instance.data.id, skillId: skill.data.id, limit: 1 }
      : null
  );
  let hasNoVersions = !!versions.data && versions.data.items.length == 0;

  let isEnabled = useSkillSecurityReviewsEnabled();
  let review = useSkillSecurityReview(instance.data?.id, skill.data?.id);
  let reassess = review.useReassessMutator();
  let dismiss = review.useDismissMutator();
  let restore = review.useRestoreMutator();

  let [searchParams, setSearchParams] = useSearchParams();
  let selectedRevisionId = searchParams.get(REVISION_PARAM);

  let revisions = useSkillSecurityReviewRevisions(instance.data?.id, skill.data?.id, {
    limit: HISTORY_LIMIT,
    order: 'desc'
  });
  let selectedRevision = useSkillSecurityReviewRevision(
    instance.data?.id,
    skill.data?.id,
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

  if (!isEnabled || isSecurityReviewNotFound(review.error)) {
    return (
      <EmptyState
        title="Security Assessment Unavailable"
        description="Security reviews are not available for this skill."
      />
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

    let header = (
      <SecurityReportHeader>
        <div>
          <Title as="h2" size="5" weight="strong">
            Security Assessment
          </Title>
          <Text size="2" color="gray600">
            What this skill makes an agent do, and whether its files can be trusted.
          </Text>
        </div>

        <SecurityReportHeaderActions>
          <SkillVerdictBadge review={review.data} size="2" />

          {!isDismissed && (
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

          {!isDismissed && canWriteSkill && (
            <Button
              size="2"
              variant="outline"
              iconLeft={<RiRefreshLine />}
              disabled={!!inProgress || dismiss.isLoading}
              loading={reassess.isLoading}
              success={reassess.isSuccess}
              onClick={() => reassess.mutate(undefined)}
            >
              {inProgress ? 'Reassessing' : hasNoVersions ? 'Review Now' : 'Reassess Skill'}
            </Button>
          )}
        </SecurityReportHeaderActions>
      </SecurityReportHeader>
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
        <>
          {header}
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
                  Its verdict no longer holds the skill back. Restore the review to resume
                  assessments.
                </>
              }
              action={restoreButton}
            />
          </SecurityReportVerdict>
        </>
      );
    }

    if (!displayed) {
      return (
        <>
          {header}
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
                description="Reviews wait a while to start for now skills."
                action={
                  canWriteSkill ? (
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
                  canWriteSkill
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
        </>
      );
    }

    return (
      <>
        {header}
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
      </>
    );
  });
};
