import { renderWithLoader } from '@metorial/data-hooks';
import { EmptyState } from '@metorial/empty-state';
import {
  useCurrentInstance,
  useProvider,
  useProviderVersion,
  useProviderVersionsByIds,
  useSecurityReview,
  useSecurityReviewRevision,
  useSecurityReviewRevisions,
  useSecurityReviewsEnabled,
  type SecurityReviewRevision
} from '@metorial/state';
import { Button, Callout, Select, Text, theme, Title } from '@metorial/ui';
import { RiRefreshLine } from '@remixicon/react';
import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { styled } from 'styled-components';
import {
  CapabilitiesSection,
  ChangesSection,
  FindingsSection,
  getDisplayedRevision,
  getReviewRevisions,
  ImplementationSection,
  isSecurityReviewNotFound,
  MethodSection,
  ProvenanceSection,
  SecurityAssessmentBody,
  SecurityReportAside,
  SecurityReviewAiLabel,
  SecurityReviewMeta,
  type ReportContentsEntry
} from '../../scenes/securityReview';
import { useProviderVersionContext } from './providerVersionContext';

let REVISION_PARAM = 'revision';
let HISTORY_LIMIT = 5;

let Header = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
`;

let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

let Layout = styled.div`
  display: grid;
  align-items: start;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 48px;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
`;

let Verdict = styled.article`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  box-shadow: ${theme.shadows.small};
  background: ${theme.colors.background};
  padding: 20px;
  scroll-margin-top: 80px;
`;

let VerdictHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
`;

let VerdictFooter = styled.div`
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let numbered = (index: number) => String(index + 1).padStart(2, '0');

let ReportSections = ({ revision }: { revision: SecurityReviewRevision }) => {
  let sections = [
    {
      id: 'provenance',
      render: (n: string) => <ProvenanceSection number={n} revision={revision} />
    },
    ...(revision.report.implementation
      ? [
          {
            id: 'implementation',
            render: (n: string) => <ImplementationSection number={n} revision={revision} />
          }
        ]
      : []),
    {
      id: 'capabilities',
      render: (n: string) => <CapabilitiesSection number={n} revision={revision} />
    },
    {
      id: 'findings',
      render: (n: string) => <FindingsSection number={n} revision={revision} />
    },
    {
      id: 'changes',
      render: (n: string) => <ChangesSection number={n} revision={revision} />
    },
    { id: 'method', render: (n: string) => <MethodSection number={n} revision={revision} /> }
  ];

  return (
    <>
      {sections.map((section, i) => (
        <div key={section.id}>{section.render(numbered(i))}</div>
      ))}
    </>
  );
};

let getContents = (revision: SecurityReviewRevision): ReportContentsEntry[] => [
  { id: 'verdict', label: 'Verdict' },
  { id: 'provenance', label: 'Publisher & provenance' },
  ...(revision.report.implementation
    ? [{ id: 'implementation', label: 'Implementation review' }]
    : []),
  { id: 'capabilities', label: 'Capabilities & exposure' },
  { id: 'findings', label: 'Findings' },
  { id: 'changes', label: 'What changed' },
  { id: 'method', label: 'Method & limits' }
];

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
  let review = useSecurityReview(
    instance.data?.id,
    provider.data?.id,
    isDefaultVersion ? undefined : selectedVersionId
  );
  let reassess = review.useReassessMutator();

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
  useEffect(() => {
    if (currentRevisionId) revisions.refetch();
  }, [currentRevisionId]);

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
    isSecurityReviewNotFound(review.error) ||
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
    let canReassess = review.data.maintainedBy == 'organization' && !inProgress;
    let isHistorical = !!displayed && !!current && displayed.id != current.id;
    let versionLabel = displayedVersion.data?.version;

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
      <Header>
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

        <HeaderActions>
          {versionSelect}
          {reassessButton}
        </HeaderActions>
      </Header>
    );

    if (!displayed) {
      return (
        <>
          {header}
          <reassess.RenderError />

          <Verdict id="verdict">
            <VerdictHeader>
              <Title as="h3" size="3" weight="strong">
                Review Progress
              </Title>
              <SecurityReviewAiLabel revision={null} />
            </VerdictHeader>

            <SecurityAssessmentBody
              review={review.data}
              detailed
              retry={{
                onClick: () => reassess.mutate(undefined),
                loading: reassess.isLoading,
                success: reassess.isSuccess
              }}
            />
          </Verdict>

          <Text size="1" color="gray600" style={{ marginTop: 12 }}>
            Read-only review. No tools are executed and no configuration secrets are included.
            You can leave this page; the report appears here when it is ready.
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

        <Layout>
          <div>
            <Verdict id="verdict">
              <VerdictHeader>
                <Title as="h3" size="3" weight="strong">
                  Verdict
                </Title>
                <SecurityReviewAiLabel revision={displayed} />
              </VerdictHeader>

              <SecurityAssessmentBody
                review={review.data}
                revision={displayed.id == inProgress?.id ? null : displayed}
                detailed
                versionLabel={versionLabel}
                toolCount={displayed.scores?.counts.toolsExpected}
              />

              {displayed.status != 'queued' && displayed.status != 'running' && (
                <VerdictFooter>
                  <SecurityReviewMeta
                    revision={displayed}
                    versionLabel={versionLabel}
                    checkedAt={isHistorical ? null : review.data.lastCheckedAt}
                  />
                </VerdictFooter>
              )}
            </Verdict>

            <ReportSections revision={displayed} />
          </div>

          <SecurityReportAside
            revision={displayed}
            versionLabel={versionLabel}
            contents={getContents(displayed)}
            history={history}
            currentRevisionId={currentRevisionId}
            selectedRevisionId={displayed.id}
            versionLabels={versionLabels}
            onSelectRevision={selectRevision}
          />
        </Layout>
      </>
    );
  });
};
