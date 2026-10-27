import { Badge, Datalist, RenderDate, Text, theme, Title } from '@metorial/ui';
import { RiInformationLine } from '@remixicon/react';
import type React from 'react';
import { styled } from 'styled-components';
import {
  confidenceLabels,
  isSkillRevision,
  triggerLabels,
  type AnySecurityReviewRevision
} from './lib';

let Aside = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
`;

let Contents = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 2px;

  a {
    padding: 4px 10px;
    border-left: 2px solid ${theme.colors.gray300};
    font-size: 13px;
    color: ${theme.colors.gray700};
    text-decoration: none;

    &:hover {
      color: ${theme.colors.gray900};
      border-left-color: ${theme.colors.gray600};
    }
  }
`;

let History = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let HistoryItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid ${({ $active }) => ($active ? theme.colors.gray400 : 'transparent')};
  background: ${({ $active }) => ($active ? theme.colors.gray200 : 'transparent')};
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray200};
  }
`;

let HistoryText = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-grow: 1;
  min-width: 0;
  font-size: 13px;
  color: ${theme.colors.gray900};
`;

let HistoryScore = styled.span`
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${theme.colors.gray900};
`;

let Note = styled.div`
  display: flex;
  gap: 8px;
  color: ${theme.colors.gray700};

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

let scrollToReportSection = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
  if (event.button != 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;

  let section = document.getElementById(id);
  if (!section) return;

  event.preventDefault();

  let container = section.parentElement;
  while (container) {
    let overflow = window.getComputedStyle(container).overflowY;
    if (
      (overflow == 'auto' || overflow == 'scroll') &&
      container.scrollHeight > container.clientHeight
    )
      break;
    container = container.parentElement;
  }

  let header = (container ?? document).querySelector<HTMLElement>(
    '[data-details-layout-header]'
  );
  let offset = (header?.getBoundingClientRect().height ?? 0) + 16;
  let behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'instant'
    : 'smooth';

  if (container) {
    let top =
      container.scrollTop +
      section.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      offset;
    container.scrollTo({ top, behavior } as any);
  } else {
    window.scrollTo({
      top: window.scrollY + section.getBoundingClientRect().top - offset,
      behavior
    } as any);
  }
};

export type ReportContentsEntry = { id: string; label: string };

let getCoverage = (revision: AnySecurityReviewRevision) => {
  if (isSkillRevision(revision)) {
    if (!revision.files) return null;

    return {
      label: 'Files analyzed',
      value: `${revision.files.analyzed} of ${revision.files.total}`
    };
  }

  if (!revision.scores) return null;

  return {
    label: 'Tools reviewed',
    value: `${revision.scores.counts.toolsReviewed} of ${revision.scores.counts.toolsExpected}`
  };
};

let getRevisionVersionId = (revision: AnySecurityReviewRevision) =>
  isSkillRevision(revision) ? revision.skillVersionId : revision.providerVersionId;

export let SecurityReportAside = ({
  revision,
  versionLabel,
  contents,
  history,
  currentRevisionId,
  selectedRevisionId,
  versionLabels,
  onSelectRevision
}: {
  revision: AnySecurityReviewRevision;
  versionLabel?: string | null;
  contents: ReportContentsEntry[];
  history: AnySecurityReviewRevision[];
  currentRevisionId: string | null;
  selectedRevisionId: string;
  versionLabels: Record<string, string>;
  onSelectRevision: (revisionId: string) => void;
}) => {
  let scores = revision.scores;
  let coverage = getCoverage(revision);
  let triggerReason = isSkillRevision(revision) ? null : revision.triggerReason;

  return (
    <Aside>
      <div>
        <Text size="1" weight="strong" color="gray600" style={{ marginBottom: 8 }}>
          In This Report
        </Text>
        <Contents aria-label="Report contents">
          {contents.map(entry => (
            <a
              key={entry.id}
              href={`#${entry.id}`}
              onClick={event => scrollToReportSection(event, entry.id)}
            >
              {entry.label}
            </a>
          ))}
        </Contents>
      </div>

      <div>
        <Title as="h4" size="2" weight="strong" style={{ marginBottom: 8 }}>
          Assessment Details
        </Title>
        <Datalist
          items={[
            ...(versionLabel ? [{ label: 'Version', value: versionLabel }] : []),
            ...(scores
              ? [{ label: 'Confidence', value: confidenceLabels[scores.confidence] }]
              : []),
            ...(coverage ? [coverage] : []),
            {
              label: 'Reviewed at',
              value: <RenderDate date={revision.completedAt ?? revision.createdAt} />
            }
          ]}
        />
      </div>

      {history.length > 0 && (
        <div id="history">
          <Title as="h4" size="2" weight="strong" style={{ marginBottom: 8 }}>
            Assessment History
          </Title>
          <History>
            {history.map(item => {
              let versionId = getRevisionVersionId(item);

              return (
                <HistoryItem
                  key={item.id}
                  type="button"
                  $active={item.id == selectedRevisionId}
                  aria-current={item.id == selectedRevisionId ? 'true' : undefined}
                  onClick={() => onSelectRevision(item.id)}
                >
                  <HistoryText>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <RenderDate date={item.completedAt ?? item.createdAt} format="date" />
                      {item.id == currentRevisionId && (
                        <Badge color="gray" size="1">
                          Latest
                        </Badge>
                      )}
                    </span>
                    <Text size="1" color="gray600" as="span">
                      {versionId && versionLabels[versionId]
                        ? `Version ${versionLabels[versionId]} · `
                        : ''}
                      {triggerLabels[item.trigger]}
                    </Text>
                  </HistoryText>
                  <HistoryScore>{item.scores?.securityScore ?? '—'}</HistoryScore>
                </HistoryItem>
              );
            })}
          </History>
        </div>
      )}

      <Note>
        <RiInformationLine size={14} />
        <Text size="1" color="gray700">
          <strong>A point-in-time assessment.</strong> This report covers the reviewed version
          and the evidence available at the time. New versions or changes to the provider will
          lead to new assessments and reports.
        </Text>
      </Note>
    </Aside>
  );
};
