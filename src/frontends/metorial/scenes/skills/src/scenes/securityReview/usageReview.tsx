import { Paths } from '@metorial/frontend-config';
import {
  useCurrentOrganization,
  useCurrentProject,
  type UsageReview,
  type UsageReviewRevision
} from '@metorial/state';
import { Badge, Button, Text } from '@metorial/ui';
import { EvidenceList, LevelBadge, Table } from '@metorial/ui-product';
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiBarChart2Line,
  RiRefreshLine
} from '@remixicon/react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SecurityReviewProgress } from './assessment';
import { capabilityTags, levelLabels, usageReviewStages } from './lib';
import {
  FindingsAccordion,
  ReportCard,
  ReportChip,
  ReportChips,
  ReportIconRow,
  ReportSection,
  ReportSectionHeading,
  ReportTableFooter,
  ReportTags,
  ReportToolKey
} from './report';

let COLLAPSED_ROW_COUNT = 8;

type UsageStats = NonNullable<UsageReviewRevision['scores']>['stats'];

export type UsageReviewReassess = { onClick: () => void; loading: boolean; success: boolean };

let formatCount = (value: number) => value.toLocaleString();

let isRevisionRunning = (revision: UsageReviewRevision | null) =>
  revision?.status == 'queued' || revision?.status == 'running';

let ExpandableTable = ({
  headers,
  rows,
  noun
}: {
  headers: string[];
  rows: React.ReactNode[][];
  noun: string;
}) => {
  let [expanded, setExpanded] = useState(false);
  let visible = expanded ? rows : rows.slice(0, COLLAPSED_ROW_COUNT);

  return (
    <>
      <Table headers={headers} data={visible} />

      <ReportTableFooter>
        <Text size="1" color="gray600">
          Showing {visible.length} of {rows.length} {noun}
        </Text>

        {rows.length > COLLAPSED_ROW_COUNT && (
          <Button
            size="1"
            variant="ghost"
            iconRight={expanded ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Collapse' : `View All ${noun}`}
          </Button>
        )}
      </ReportTableFooter>
    </>
  );
};

let SubHeading = ({ children }: { children: React.ReactNode }) => (
  <Text size="2" weight="strong" style={{ margin: '20px 0 8px' }}>
    {children}
  </Text>
);

let ToolUsageTable = ({ stats }: { stats: UsageStats }) => {
  let tools = [...stats.tools].sort((a, b) => b.calls - a.calls || a.key.localeCompare(b.key));

  return (
    <ExpandableTable
      noun="Tools"
      headers={['Tool', 'Capability', 'Calls', 'Errors', 'Status']}
      rows={tools.map(tool => [
        <ReportToolKey>{tool.key}</ReportToolKey>,
        <ReportTags>
          {tool.tags.map(tag => (
            <LevelBadge key={tag} level={capabilityTags[tag].level}>
              {capabilityTags[tag].label}
            </LevelBadge>
          ))}
        </ReportTags>,
        <Text size="2">{formatCount(tool.calls)}</Text>,
        <Text size="2">{formatCount(tool.errors)}</Text>,
        !tool.allowed ? (
          <Badge color="gray">Blocked by Filter</Badge>
        ) : tool.calls > 0 ? (
          <Badge color="green">Used</Badge>
        ) : (
          <Badge color="gray">Never Used</Badge>
        )
      ])}
    />
  );
};

let ScopeUsageTable = ({ stats }: { stats: UsageStats }) => (
  <ExpandableTable
    noun="Scopes"
    headers={['Scope', 'Auth Configs', 'Needed By Used Tools']}
    rows={stats.scopes.map(scope => [
      <ReportToolKey>{scope.scope}</ReportToolKey>,
      <Text size="2">{formatCount(scope.authConfigs)}</Text>,
      scope.requiredByUsedTool ? (
        <Badge color="green">Yes</Badge>
      ) : (
        <Badge color="yellow">No</Badge>
      )
    ])}
  />
);

let ProtoGuardTable = ({ stats }: { stats: UsageStats }) => (
  <ExpandableTable
    noun="Matches"
    headers={['Filter', 'Issue', 'Severity', 'Matches']}
    rows={[...stats.protoguard.filters]
      .sort((a, b) => b.matches - a.matches)
      .map(filter => [
        <ReportToolKey>{filter.filter}</ReportToolKey>,
        <Text size="2">{filter.issueType.replace(/_/g, ' ')}</Text>,
        <Text size="2">{filter.severity}</Text>,
        <Text size="2">{formatCount(filter.matches)}</Text>
      ])}
  />
);

let UsageProse = ({
  title,
  section
}: {
  title: string;
  section: {
    body: string;
    evidence: React.ComponentProps<typeof EvidenceList>['evidence'];
  } | null;
}) =>
  section ? (
    <>
      <SubHeading>{title}</SubHeading>
      <Text size="2" color="gray800" style={{ marginBottom: 8 }}>
        {section.body}
      </Text>
      <EvidenceList evidence={section.evidence} />
    </>
  ) : null;

let UsageStatus = ({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <ReportCard>
    <ReportIconRow>
      <RiBarChart2Line size={18} />
      <div style={{ flexGrow: 1 }}>
        <Text size="2" weight="strong">
          {title}
        </Text>
        <Text size="2" color="gray700" style={{ marginTop: 4 }}>
          {description}
        </Text>
        {action && <div style={{ marginTop: 12 }}>{action}</div>}
      </div>
    </ReportIconRow>
  </ReportCard>
);

let UsageReport = ({ revision }: { revision: UsageReviewRevision }) => {
  let { scores, report } = revision;
  let stats = scores?.stats;

  return (
    <>
      {report.summary && (
        <>
          <Text size="2" color="gray800">
            {report.summary.text}
          </Text>
          <Text size="2" color="gray700" style={{ marginTop: 6 }}>
            {report.summary.exposureNote}
          </Text>
        </>
      )}

      {scores && stats && (
        <ReportChips style={{ marginTop: 16 }}>
          <ReportChip>
            <strong>{formatCount(stats.calls)}</strong> Calls in {stats.windowDays} Days
          </ReportChip>
          <ReportChip>
            <strong>{scores.counts.toolsUsed}</strong> of {scores.counts.toolsAllowed} Tools
            Used
          </ReportChip>
          {scores.counts.scopesUnused > 0 && (
            <ReportChip>
              <strong>{scores.counts.scopesUnused}</strong> Unused Scopes
            </ReportChip>
          )}
          <ReportChip>
            <strong>{formatCount(stats.protoguard.matches)}</strong> ProtoGuard Matches
          </ReportChip>
        </ReportChips>
      )}

      <UsageProse title="Observed Exposure" section={report.observedExposure} />
      <UsageProse title="Access" section={report.access} />
      <UsageProse title="Runtime" section={report.runtime} />

      {stats && (
        <>
          <SubHeading>Tool Usage</SubHeading>
          <ToolUsageTable stats={stats} />

          {stats.scopes.length > 0 && (
            <>
              <SubHeading>Granted Scopes</SubHeading>
              <ScopeUsageTable stats={stats} />
            </>
          )}

          {stats.protoguard.filters.length > 0 && (
            <>
              <SubHeading>ProtoGuard Matches</SubHeading>
              <ProtoGuardTable stats={stats} />
            </>
          )}
        </>
      )}

      {revision.findings.length > 0 && (
        <>
          <SubHeading>Findings</SubHeading>
          <FindingsAccordion findings={revision.findings} showNew={false} />
        </>
      )}

      {report.recommendations.length > 0 && (
        <>
          <SubHeading>Recommendations</SubHeading>
          <ReportCard>
            {report.recommendations.map((recommendation, i) => (
              <div key={i}>
                <Text size="2" weight="strong">
                  {recommendation.title}
                </Text>
                <Text size="2" color="gray700" style={{ margin: '4px 0 8px' }}>
                  {recommendation.body}
                </Text>
                <EvidenceList evidence={recommendation.evidence} />
              </div>
            ))}
          </ReportCard>
        </>
      )}

      {report.method && report.method.limitations.length > 0 && (
        <Text size="1" color="gray600" style={{ marginTop: 16 }}>
          {report.method.limitations.join(' ')}
        </Text>
      )}
    </>
  );
};

let SettingsLink = () => {
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return (
    <Link
      to={Paths.organization.settings(
        organization.data,
        'project',
        project.data?.slug,
        'ai-analysis'
      )}
      style={{ color: 'inherit', textDecoration: 'underline' }}
    >
      Enable usage reviews in the project settings
    </Link>
  );
};

export let UsageReviewSection = ({
  number,
  usage,
  reassess,
  canReassess
}: {
  number: string;
  usage: UsageReview;
  reassess: UsageReviewReassess;
  canReassess: boolean;
}) => {
  let revision = usage.currentRevision ?? usage.inProgressRevision;
  let running = isRevisionRunning(usage.inProgressRevision);

  let reassessButton = usage.canRun ? (
    <Button
      size="1"
      variant="outline"
      iconLeft={<RiRefreshLine />}
      disabled={!canReassess || running}
      loading={reassess.loading}
      success={reassess.success}
      onClick={reassess.onClick}
    >
      {running ? 'Reviewing' : usage.status == 'ready' ? 'Review Again' : 'Review Now'}
    </Button>
  ) : null;

  return (
    <ReportSection id="usage">
      <ReportSectionHeading
        number={number}
        title="Observed Usage"
        trailing={
          <>
            {usage.currentRevision?.scores && (
              <LevelBadge level={usage.currentRevision.scores.exposure}>
                {levelLabels[usage.currentRevision.scores.exposure]} Observed Exposure
              </LevelBadge>
            )}
            {reassessButton}
          </>
        }
      />

      <Text size="2" color="gray700" style={{ marginBottom: 12 }}>
        How this integration is used in this project, based on aggregated usage counts.
        Messages, tokens, and user data are never included.
      </Text>

      {usage.status == 'disabled' && (
        <UsageStatus
          title="Usage reviews are turned off."
          description="Turn them on to see which tools and scopes this project really uses, and what to narrow."
          action={
            <Text size="2">
              <SettingsLink />
            </Text>
          }
        />
      )}

      {usage.status == 'waiting_for_review' && (
        <UsageStatus
          title="Waiting for the security assessment."
          description="The usage review starts once the security assessment of this provider is complete."
        />
      )}

      {usage.status == 'not_enough_data' && (
        <UsageStatus
          title="There is not enough usage data yet."
          description={
            usage.canRun
              ? 'Use this integration more and the review runs on its own. You can also run it now on the little usage there is.'
              : 'Use this integration more. The usage review appears here once it has seen enough activity.'
          }
        />
      )}

      {usage.status == 'pending' && !revision && (
        <UsageStatus
          title="A usage review is scheduled."
          description="It runs automatically and appears here when it is done."
        />
      )}

      {revision && !usage.currentRevision && (
        <ReportCard>
          <SecurityReviewProgress
            revision={revision}
            stages={usageReviewStages}
            label="usage review"
          />
        </ReportCard>
      )}

      {usage.currentRevision && <UsageReport revision={usage.currentRevision} />}
    </ReportSection>
  );
};
