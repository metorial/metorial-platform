import type { SecurityReviewRevision, SkillSecurityReviewRevision } from '@metorial/state';
import {
  Accordion,
  Badge,
  Button,
  OptionToggle,
  Select,
  Skeleton,
  Text,
  theme,
  Title
} from '@metorial/ui';
import { EvidenceList, LevelBadge, Table } from '@metorial/ui-product';
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCheckLine,
  RiCloseLine,
  RiFingerprintLine,
  RiFlashlightLine,
  RiInformationLine,
  RiShieldCheckLine
} from '@remixicon/react';
import React, { useMemo, useState } from 'react';
import { styled } from 'styled-components';
import {
  behaviorTags,
  capabilityTags,
  findingKindLabels,
  getBehaviorRank,
  getPreviousScore,
  getReviewSubject,
  getToolRank,
  isDeterministicRevision,
  isRevisionRunning,
  isSkillRevision,
  levelLabels,
  provenanceLabels,
  severityLabels,
  severityLevels,
  type AnySecurityReviewRevision,
  type SecurityReviewFinding,
  type SecurityReviewTool
} from './lib';

let KEY_TOOL_COUNT = 8;

type Implementation = NonNullable<SecurityReviewRevision['report']['implementation']>;

let Section = styled.section`
  margin-top: 36px;
  scroll-margin-top: 80px;
`;

let Heading = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
`;

let HeadingNumber = styled.span`
  /* font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace; */
  font-size: 16px;
  color: ${theme.colors.gray600};
  font-weight: 600;
`;

let HeadingTrailing = styled.div`
  margin-left: auto;
  display: flex;
  gap: 6px;
`;

let Card = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  padding: 16px;
  background: ${theme.colors.background};
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let IconRow = styled.div`
  display: flex;
  gap: 12px;

  & > svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${theme.colors.gray700};
  }
`;

let Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
`;

let Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid ${theme.colors.gray300};
  font-size: 12px;
  color: ${theme.colors.gray700};

  strong {
    color: ${theme.colors.gray900};
  }
`;

let ToolKey = styled.span`
  font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray900};
`;

let Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

let HintStatus = styled.span<{ $mismatch: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: ${({ $mismatch }) => ($mismatch ? theme.colors.red900 : theme.colors.gray700)};
`;

let TableFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
`;

let Filters = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
`;

let FindingTitle = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  & > svg {
    flex-shrink: 0;
    color: ${theme.colors.gray600};
  }
`;

let FindingContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let Fix = styled.div`
  padding: 12px 14px;
  border-radius: 8px;
  background: ${theme.colors.gray200};
`;

let List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let ListItem = styled.li`
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: ${theme.colors.gray800};

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${theme.colors.gray600};
  }
`;

let MethodGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;

  @media (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

let Delta = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${theme.colors.gray900};
`;

let DeltaChange = styled.span<{ $direction: number }>`
  font-size: 13px;
  font-weight: 600;
  color: ${({ $direction }) =>
    $direction < 0
      ? theme.colors.red900
      : $direction > 0
        ? theme.colors.green900
        : theme.colors.gray600};
`;

export let ReportSectionHeading = ({
  number,
  title,
  trailing
}: {
  number: string;
  title: string;
  trailing?: React.ReactNode;
}) => (
  <Heading>
    <HeadingNumber>{number}</HeadingNumber>
    <Title as="h3" size="3" weight="strong">
      {title}
    </Title>
    {trailing && <HeadingTrailing>{trailing}</HeadingTrailing>}
  </Heading>
);

let PendingSection = () => (
  <Skeleton>
    <Text size="2" color="gray600">
      This section appears once the reviewer has written it.
    </Text>
  </Skeleton>
);

export let ProvenanceSection = ({
  number,
  revision
}: {
  number: string;
  revision: AnySecurityReviewRevision;
}) => {
  let provenance = revision.report.provenance;
  if (!provenance && !isRevisionRunning(revision)) return null;

  return (
    <Section id="provenance">
      <ReportSectionHeading
        number={number}
        title={isSkillRevision(revision) ? 'Origin & Provenance' : 'Publisher & Provenance'}
      />

      {provenance ? (
        <Card>
          <IconRow>
            {provenance.class == 'impersonation_suspected' ? (
              <RiAlertLine size={18} />
            ) : (
              <RiFingerprintLine size={18} />
            )}
            <div>
              <Text size="2" weight="strong">
                {provenanceLabels[provenance.class]}
              </Text>
              <Text size="2" color="gray700" style={{ marginTop: 4 }}>
                {provenance.body}
              </Text>
            </div>
          </IconRow>

          {'evidence' in provenance && <EvidenceList evidence={provenance.evidence} />}
        </Card>
      ) : (
        <PendingSection />
      )}
    </Section>
  );
};

export let ImplementationSection = ({
  number,
  revision
}: {
  number: string;
  revision: AnySecurityReviewRevision;
}) => {
  let implementation: Implementation | null = revision.report.implementation;
  if (!implementation) return null;

  let points = [
    ...implementation.weaknesses.map(point => ({ ...point, kind: 'weakness' as const })),
    ...implementation.strengths.map(point => ({ ...point, kind: 'strength' as const }))
  ];

  return (
    <Section id="implementation">
      <ReportSectionHeading number={number} title="Implementation Review" />

      <Card>
        {points.map((point, i) => (
          <IconRow key={i}>
            {point.kind == 'weakness' ? (
              <RiAlertLine size={18} />
            ) : (
              <RiShieldCheckLine size={18} />
            )}
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <Text size="2" weight="strong">
                {point.title}
              </Text>
              <Text size="2" color="gray700" style={{ margin: '4px 0 8px' }}>
                {point.body}
              </Text>
              <EvidenceList evidence={point.evidence} />
            </div>
          </IconRow>
        ))}

        {!points.length && (
          <Text size="2" color="gray600">
            No notable strengths or weaknesses were recorded.
          </Text>
        )}
      </Card>
    </Section>
  );
};

let HintCell = ({ tool }: { tool: SecurityReviewTool }) => {
  if (tool.hintAccuracy == 'mismatch') {
    return (
      <HintStatus $mismatch>
        <RiCloseLine size={14} />
        Mismatch
      </HintStatus>
    );
  }

  if (tool.hintAccuracy == 'undeclared') {
    return (
      <HintStatus $mismatch={false}>
        <RiInformationLine size={14} />
        Not Declared
      </HintStatus>
    );
  }

  return (
    <HintStatus $mismatch={false}>
      <RiCheckLine size={14} />
      Matches
    </HintStatus>
  );
};

let ToolCapabilitiesSection = ({
  number,
  revision
}: {
  number: string;
  revision: SecurityReviewRevision;
}) => {
  let [expanded, setExpanded] = useState(false);
  let capabilities = revision.report.capabilities;
  let scores = revision.scores;

  let tools = useMemo(
    () =>
      [...(capabilities?.tools ?? [])].sort(
        (a, b) => getToolRank(b) - getToolRank(a) || a.key.localeCompare(b.key)
      ),
    [capabilities]
  );

  if (!capabilities && !isRevisionRunning(revision)) return null;

  let visibleTools = expanded ? tools : tools.slice(0, KEY_TOOL_COUNT);
  let isObserved = revision.awaitingTools || scores?.confidence == 'low';

  return (
    <Section id="capabilities">
      <ReportSectionHeading
        number={number}
        title="Capabilities & Exposure"
        trailing={
          scores && (
            <LevelBadge level={scores.exposure}>
              {levelLabels[scores.exposure]} {isObserved ? 'Observed ' : ''}Exposure
            </LevelBadge>
          )
        }
      />

      {capabilities ? (
        <>
          <Text size="2" color="gray700" style={{ marginBottom: 12 }}>
            {isObserved
              ? 'Exposure covers the tools that could be inspected. Undiscovered tools are excluded.'
              : 'Capabilities describe what tools can do.'}
          </Text>

          {scores && (
            <Chips>
              <Chip>
                <strong>{scores.counts.readTools}</strong> Read
              </Chip>
              {scores.counts.writeTools > 0 && (
                <Chip>
                  <strong>{scores.counts.writeTools}</strong> Write
                </Chip>
              )}
              {scores.counts.destructiveTools > 0 && (
                <Chip>
                  <strong>{scores.counts.destructiveTools}</strong> Destructive
                </Chip>
              )}
              {scores.counts.toolsReviewed < scores.counts.toolsExpected ? (
                <Chip>
                  <strong>{scores.counts.toolsExpected - scores.counts.toolsReviewed}</strong>{' '}
                  Unverified
                </Chip>
              ) : (
                <Chip>
                  <RiCheckLine size={13} />
                  All {scores.counts.toolsExpected} tools reviewed
                </Chip>
              )}
              {scores.lethalTrifecta && (
                <Chip>
                  <RiFlashlightLine size={13} />
                  Private data, untrusted input and external send combined
                </Chip>
              )}
            </Chips>
          )}

          <Table
            headers={['Tool & Behavior', 'Capability']}
            data={visibleTools.map(tool => ({
              data: [
                <div>
                  <ToolKey>{tool.name ?? tool.key}</ToolKey>
                  <Text size="1" color="gray700" style={{ marginTop: 2 }}>
                    {tool.behavior}
                  </Text>
                </div>,
                <Tags>
                  {tool.tags.map(tag => (
                    <LevelBadge key={tag} level={capabilityTags[tag].level}>
                      {capabilityTags[tag].label}
                    </LevelBadge>
                  ))}
                </Tags>
              ]
            }))}
          />

          <TableFooter>
            <Text size="1" color="gray600">
              Showing {visibleTools.length} of {tools.length} tools · MCP annotations are
              checked against observed behavior.
            </Text>

            {tools.length > KEY_TOOL_COUNT && (
              <Button
                size="1"
                variant="ghost"
                iconRight={expanded ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Collapse' : 'View All Tools'}
              </Button>
            )}
          </TableFooter>
        </>
      ) : (
        <PendingSection />
      )}
    </Section>
  );
};

let BehaviorsSection = ({
  number,
  revision
}: {
  number: string;
  revision: SkillSecurityReviewRevision;
}) => {
  let scores = revision.scores;
  let isObserved = scores?.confidence == 'low';

  let behaviors = useMemo(
    () =>
      [...revision.report.behaviors].sort(
        (a, b) => getBehaviorRank(b) - getBehaviorRank(a) || a.tag.localeCompare(b.tag)
      ),
    [revision.report.behaviors]
  );

  if (!behaviors.length && isRevisionRunning(revision)) {
    return (
      <Section id="capabilities">
        <ReportSectionHeading number={number} title="Behaviors & Exposure" />
        <PendingSection />
      </Section>
    );
  }

  return (
    <Section id="capabilities">
      <ReportSectionHeading
        number={number}
        title="Behaviors & Exposure"
        trailing={
          scores && (
            <LevelBadge level={scores.exposure}>
              {levelLabels[scores.exposure]} {isObserved ? 'Observed ' : ''}Exposure
            </LevelBadge>
          )
        }
      />

      <Text size="2" color="gray700" style={{ marginBottom: 12 }}>
        Behaviors describe what this skill makes an agent do. Dangerous behaviors increase
        exposure without lowering the security score.
      </Text>

      {(revision.files || scores?.lethalTrifecta) && (
        <Chips>
          {revision.files && (
            <Chip>
              <strong>{revision.files.analyzed}</strong> of {revision.files.total} files
              analyzed
            </Chip>
          )}
          {scores?.lethalTrifecta && (
            <Chip>
              <RiFlashlightLine size={13} />
              Private data, untrusted input and external send combined
            </Chip>
          )}
        </Chips>
      )}

      <Card>
        {behaviors.map((behavior, i) => (
          <IconRow key={i}>
            <RiFlashlightLine size={18} />
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <LevelBadge level={behaviorTags[behavior.tag].level}>
                {behaviorTags[behavior.tag].label}
              </LevelBadge>
              <Text size="2" color="gray700" style={{ margin: '6px 0 8px' }}>
                {behavior.body}
              </Text>
              <EvidenceList evidence={behavior.evidence} />
            </div>
          </IconRow>
        ))}

        {!behaviors.length && (
          <Text size="2" color="gray600">
            No notable behaviors were identified in this skill.
          </Text>
        )}
      </Card>
    </Section>
  );
};

export let CapabilitiesSection = ({
  number,
  revision
}: {
  number: string;
  revision: AnySecurityReviewRevision;
}) =>
  isSkillRevision(revision) ? (
    <BehaviorsSection number={number} revision={revision} />
  ) : (
    <ToolCapabilitiesSection number={number} revision={revision} />
  );

type KindFilter = 'all' | SecurityReviewFinding['kind'];

let findingIcons: Record<SecurityReviewFinding['kind'], React.ReactNode> = {
  security: <RiAlertLine size={16} />,
  capability: <RiFlashlightLine size={16} />,
  positive: <RiShieldCheckLine size={16} />
};

let FindingBody = ({ finding }: { finding: SecurityReviewFinding }) => (
  <FindingContent>
    <Text size="2" color="gray800">
      {finding.body}
    </Text>

    {'toolKeys' in finding && finding.toolKeys.length > 0 && (
      <Tags>
        {finding.toolKeys.map(key => (
          <Chip key={key}>
            <ToolKey>{key}</ToolKey>
          </Chip>
        ))}
      </Tags>
    )}

    <EvidenceList evidence={finding.evidence} />

    {finding.recommendation && (
      <Fix>
        <Text size="1" weight="strong">
          Recommended Fix
        </Text>
        <Text size="2" color="gray800" style={{ marginTop: 4 }}>
          {finding.recommendation}
        </Text>
      </Fix>
    )}
  </FindingContent>
);

export let FindingsSection = ({
  number,
  revision
}: {
  number: string;
  revision: AnySecurityReviewRevision;
}) => {
  let [kind, setKind] = useState<KindFilter>('all');
  let [severity, setSeverity] = useState<string>('all');

  let findings = revision.findings.filter(finding => finding.change != 'resolved');
  if (!findings.length && isRevisionRunning(revision) && !revision.scores) {
    return (
      <Section id="findings">
        <ReportSectionHeading number={number} title="Findings" />
        <PendingSection />
      </Section>
    );
  }

  let counts = {
    security: findings.filter(f => f.kind == 'security').length,
    capability: findings.filter(f => f.kind == 'capability').length,
    positive: findings.filter(f => f.kind == 'positive').length
  };

  let filtered = findings.filter(
    finding =>
      (kind == 'all' || finding.kind == kind) &&
      (severity == 'all' || finding.severity == severity)
  );

  return (
    <Section id="findings">
      <ReportSectionHeading
        number={number}
        title="Findings"
        trailing={
          counts.security ? (
            <Badge color="red">
              {`${counts.security} Security ${counts.security == 1 ? 'Issue' : 'Issues'}`}
            </Badge>
          ) : (
            <Badge color="green">No Security Issues Found</Badge>
          )
        }
      />

      <Text size="2" color="gray700" style={{ marginBottom: 12 }}>
        {counts.security
          ? 'Security findings affect the score. Capability observations explain exposure.'
          : 'No security issues were identified in the available evidence.'}
      </Text>

      <Filters>
        <OptionToggle
          ariaLabel="Filter findings by kind"
          size="1"
          itemMinWidth={70}
          value={kind}
          onChange={value => setKind(value as KindFilter)}
          items={[
            { id: 'all', label: `All ${findings.length}` },
            { id: 'security', label: `Security ${counts.security}` },
            { id: 'capability', label: `Capabilities ${counts.capability}` },
            { id: 'positive', label: `Positive ${counts.positive}` }
          ]}
        />

        <div style={{ minWidth: 160 }}>
          <Select
            label="Severity"
            hideLabel
            size="2"
            value={severity}
            onChange={setSeverity}
            items={[
              { id: 'all', label: 'All Severities' },
              ...(['critical', 'high', 'medium', 'low', 'info'] as const).map(id => ({
                id,
                label: severityLabels[id]
              }))
            ]}
          />
        </div>
      </Filters>

      {filtered.length ? (
        <Accordion
          type="multiple"
          items={filtered.map(finding => ({
            title: (
              <FindingTitle>
                {findingIcons[finding.kind]}
                {finding.title}
                {finding.kind == 'security' ? (
                  <LevelBadge level={severityLevels[finding.severity]}>
                    {severityLabels[finding.severity]}
                  </LevelBadge>
                ) : (
                  <Badge color={finding.kind == 'positive' ? 'green' : 'yellow'}>
                    {findingKindLabels[finding.kind]}
                  </Badge>
                )}
                {finding.change == 'new' && getPreviousScore(revision) && (
                  <Badge color="blue">New</Badge>
                )}
              </FindingTitle>
            ),
            description: finding.category.replace(/_/g, ' '),
            content: <FindingBody finding={finding} />
          }))}
        />
      ) : (
        <Card>
          <IconRow>
            <RiShieldCheckLine size={18} />
            <div>
              <Text size="2" weight="strong">
                Nothing identified in this category.
              </Text>
              <Text size="2" color="gray700" style={{ marginTop: 4 }}>
                This applies to the evidence reviewed for this version.
              </Text>
            </div>
          </IconRow>
        </Card>
      )}
    </Section>
  );
};

export let ChangesSection = ({
  number,
  revision
}: {
  number: string;
  revision: AnySecurityReviewRevision;
}) => {
  let { changes, resolvedFindings } = revision.report;
  let previous = getPreviousScore(revision);
  let current = revision.scores?.securityScore;

  if (!changes && !previous && !resolvedFindings.length) {
    if (isRevisionRunning(revision)) return null;

    return (
      <Section id="changes">
        <ReportSectionHeading number={number} title="Changes Since Last Assessment" />
        <Card>
          <Text size="2" color="gray700">
            This is the first assessment of this {getReviewSubject(revision)}.
          </Text>
        </Card>
      </Section>
    );
  }

  let delta = previous && typeof current == 'number' ? current - previous.securityScore : 0;

  return (
    <Section id="changes">
      <ReportSectionHeading number={number} title="Changes Since Last Assessment" />

      <Card>
        {previous && typeof current == 'number' && (
          <Delta>
            {previous.securityScore}
            <span style={{ color: theme.colors.gray500 }}>→</span>
            {current}
            <DeltaChange $direction={delta}>
              {delta > 0 ? '+' : ''}
              {delta} {Math.abs(delta) == 1 ? 'point' : 'points'}
            </DeltaChange>
          </Delta>
        )}

        {changes && (
          <Text size="2" color="gray700">
            {changes.body}
          </Text>
        )}

        {resolvedFindings.length > 0 && (
          <List>
            {resolvedFindings.map(resolved => (
              <ListItem key={resolved.key}>
                <RiCheckLine size={14} />
                <span>
                  <strong>Resolved:</strong> {resolved.reason}
                </span>
              </ListItem>
            ))}
          </List>
        )}
      </Card>
    </Section>
  );
};

export let MethodSection = ({
  number,
  revision
}: {
  number: string;
  revision: AnySecurityReviewRevision;
}) => {
  let method = revision.report.method;
  if (!method && !isRevisionRunning(revision)) return null;

  return (
    <Section id="method">
      <ReportSectionHeading number={number} title="Method & Limits" />

      {method ? (
        <Card>
          <MethodGrid>
            <div>
              <Text size="1" weight="strong" style={{ marginBottom: 8 }}>
                Included in This Review
              </Text>
              <List>
                {method.included.map((item, i) => (
                  <ListItem key={i}>
                    <RiCheckLine size={14} />
                    {item}
                  </ListItem>
                ))}
              </List>
            </div>

            <div>
              <Text size="1" weight="strong" style={{ marginBottom: 8 }}>
                Outside the Scope
              </Text>
              <List>
                {method.outOfScope.map((item, i) => (
                  <ListItem key={i}>
                    <RiCloseLine size={14} />
                    {item}
                  </ListItem>
                ))}
              </List>
            </div>
          </MethodGrid>

          {method.limitations.length > 0 && (
            <div>
              <Text size="1" weight="strong" style={{ marginBottom: 8 }}>
                Known Limitations
              </Text>
              <List>
                {method.limitations.map((item, i) => (
                  <ListItem key={i}>
                    <RiInformationLine size={14} />
                    {item}
                  </ListItem>
                ))}
              </List>
            </div>
          )}

          <Text size="1" color="gray600">
            {isDeterministicRevision(revision)
              ? 'This report was produced by deterministic checks only. No AI analysis was used: findings come from rule-based scanners and the capabilities are derived from the published tool definitions.'
              : 'Findings are based on a deterministic analysis and AI-powered evidence collection. The final report is based on the evidence and generated by AI. Reports are reviewed for correctness and completeness.'}
          </Text>
        </Card>
      ) : (
        <PendingSection />
      )}
    </Section>
  );
};
