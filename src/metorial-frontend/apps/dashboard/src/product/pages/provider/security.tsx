import { renderWithLoader } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import {
  useCurrentInstance,
  useProvider,
  useProviderVersion,
  useProviderVersionsByIds,
  useSecurityReview,
  useSecurityReviewGenerationEnabled,
  useSecurityReviewRevision,
  useSecurityReviewRevisions,
  useSecurityReviewsEnabled
} from '@metorial/state';
import { Button, Callout, Select, Text, Title } from '@metorial/ui';
import { RiRefreshLine } from '@remixicon/react';
import { useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  getDisplayedRevision,
  getReviewRevisions,
  getSecurityReportContents,
  isSecurityReviewUnavailable,
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
  UsageReviewSection,
  type ExtraReportSection
} from '@metorial/scene-skills';
import { useProviderVersionContext } from './providerVersionContext';

let REVISION_PARAM = 'revision';
let HISTORY_LIMIT = 5;

export let ProviderSecurityPage = () => {
  let instance = useCurrentInstance();
  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  let {
    selectedVersionId,
    setSelectedVersionId,
    currentVersionId,
    allVersions,
    isDefaultVersion
  } = useProviderVersionContext();

  let isEnabled = useSecurityReviewsEnabled();
  let canGenerate = useSecurityReviewGenerationEnabled();
  let review = useSecurityReview(
    instance.data?.id,
    provider.data?.id,
    isDefaultVersion ? undefined : selectedVersionId
  );
  let reassess = review.useReassessMutator();
  let reassessUsage = review.useReassessUsageMutator();

  let [searchParams, setSearchParams] = useSearchParams();
  let selectedRevisionId = searchParams.get(REVISION_PARAM);

  let revisions = useSecurityReviewRevisions(instance.data?.id, review.data?.id, {
    limit: HISTORY_LIMIT,
    order: 'desc'
  });
  let selectedRevision = useSecurityReviewRevision(
    instance.data?.id,
    review.data?.id,
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
  let versionIds = useMemo(
    () => history.flatMap(item => (item.providerVersionId ? [item.providerVersionId] : [])),
    [history]
  );
  let historyVersions = useProviderVersionsByIds(instance.data?.id, versionIds);
  let versionLabels = useMemo(
    () => Object.fromEntries((historyVersions.data ?? []).map(v => [v.id, v.version])),
    [historyVersions.data]
  );

  let displayed =
    (selectedRevisionId && selectedRevision.data) ||
    (review.data ? getDisplayedRevision(review.data) : null);
  let displayedVersion = useProviderVersion(instance.data?.id, displayed?.providerVersionId);

  let selectRevision = (revisionId: string) => {
    let next = new URLSearchParams(searchParams);
    if (revisionId == currentRevisionId) next.delete(REVISION_PARAM);
    else next.set(REVISION_PARAM, revisionId);
    setSearchParams(next, { replace: true });
  };

  if (
    !isEnabled ||
    isSecurityReviewUnavailable(review.error) ||
    review.data?.status == 'disabled'
  ) {
    return (
      <EmptyState
        title="Security Assessment Unavailable"
        description="Security reviews are not available for this provider."
      />
    );
  }

  let versionSelect =
    allVersions.length > 1 ? (
      <div style={{ minWidth: 180 }}>
        <Select
          label="Version"
          hideLabel
          size="2"
          items={allVersions.map(version => ({
            id: version.id,
            label: version.id === currentVersionId ? 'Current Version' : version.version
          }))}
          value={selectedVersionId}
          onChange={setSelectedVersionId}
        />
      </div>
    ) : null;

  return renderWithLoader({ review })(({ review }) => {
    let { current, inProgress } = getReviewRevisions(review.data);
    let canReassess = canGenerate && review.data.maintainedBy == 'organization' && !inProgress;
    let isHistorical = !!displayed && !!current && displayed.id != current.id;
    let versionLabel = displayedVersion.data?.version;

    let usage = review.data.usageReview;
    let extraSections: ExtraReportSection[] = usage
      ? [
          {
            id: 'usage',
            label: 'Observed usage',
            render: number => (
              <UsageReviewSection
                number={number}
                usage={usage}
                canReassess={canGenerate}
                reassess={{
                  onClick: () => reassessUsage.mutate(undefined),
                  loading: reassessUsage.isLoading,
                  success: reassessUsage.isSuccess
                }}
              />
            )
          }
        ]
      : [];

    let reassessButton =
      review.data.maintainedBy == 'organization' ? (
        <Button
          size="2"
          variant="outline"
          iconLeft={<RiRefreshLine />}
          disabled={!canReassess}
          loading={reassess.isLoading}
          success={reassess.isSuccess}
          onClick={() => reassess.mutate(undefined)}
        >
          {inProgress ? 'Reassessing' : 'Reassess Provider'}
        </Button>
      ) : null;

    let header = (
      <SecurityReportHeader>
        <div>
          <Title as="h2" size="5" weight="strong">
            Security Assessment
          </Title>
          <Text size="2" color="gray600">
            {displayed && (current || displayed.report.summary)
              ? 'Evidence, capabilities, and findings for this provider.'
              : 'From provider evidence to an actionable security report.'}
          </Text>
        </div>

        <SecurityReportHeaderActions>
          {versionSelect}
          {reassessButton}
        </SecurityReportHeaderActions>
      </SecurityReportHeader>
    );

    if (!displayed) {
      return (
        <>
          {header}
          <reassess.RenderError />

          <SecurityReportVerdict id="verdict">
            <SecurityReportVerdictHeader>
              <Title as="h3" size="3" weight="strong">
                Review Progress
              </Title>
            </SecurityReportVerdictHeader>

            <SecurityAssessmentBody
              review={review.data}
              detailed
              retry={{
                onClick: () => reassess.mutate(undefined),
                loading: reassess.isLoading,
                success: reassess.isSuccess
              }}
            />
          </SecurityReportVerdict>

          <Text size="1" color="gray600" style={{ marginTop: 12 }}>
            Read-only review. No tools are executed and no configuration secrets are included.
            You can leave this page. The report appears here when it's ready.
          </Text>
        </>
      );
    }

    return (
      <>
        {header}
        <reassess.RenderError />

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
                versionLabel={versionLabel}
                toolCount={displayed.scores?.counts.toolsExpected}
              />

              {displayed.status != 'queued' && displayed.status != 'running' && (
                <SecurityReportVerdictFooter>
                  <SecurityReviewMeta
                    revision={displayed}
                    versionLabel={versionLabel}
                    checkedAt={isHistorical ? null : review.data.lastCheckedAt}
                  />
                </SecurityReportVerdictFooter>
              )}
            </SecurityReportVerdict>

            <SecurityReportSections revision={displayed} extraSections={extraSections} />
            <reassessUsage.RenderError />
          </div>

          <SecurityReportAside
            revision={displayed}
            versionLabel={versionLabel}
            contents={getSecurityReportContents(displayed, extraSections)}
            history={history}
            currentRevisionId={currentRevisionId}
            selectedRevisionId={displayed.id}
            versionLabels={versionLabels}
            onSelectRevision={selectRevision}
          />
        </SecurityReportLayout>
      </>
    );
  });
};
