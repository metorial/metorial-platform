import { FloatingBar, theme, Tooltip, type ColorType } from '@metorial/ui';
import { ScoreRing } from '@metorial/ui-product';
import { RiAlertFill, RiArrowRightSLine, RiShieldCheckLine } from '@remixicon/react';
import styled from 'styled-components';
import { SectionLinkButton } from './section';

export type SkillWorkspaceSecurityIssue = {
  key: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
};

export type SkillWorkspaceSecurity = {
  status: 'pending' | 'ready';
  score: number | null;
  color: ColorType;
  scoreLabel: string | null;
  verdictLabel: string;
  issues: SkillWorkspaceSecurityIssue[];
};

let MAX_LISTED_ISSUES = 3;

let severityColors: Record<SkillWorkspaceSecurityIssue['severity'], string> = {
  critical: theme.colors.red700,
  high: theme.colors.red700,
  medium: theme.colors.orange900,
  low: theme.colors.gray600
};

let severityLabels: Record<SkillWorkspaceSecurityIssue['severity'], string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

let formatIssueCount = (count: number) => `${count} ${count == 1 ? 'issue' : 'issues'}`;

let Summary = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 12px 10px;
`;

let SummaryCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

let SummaryTitle = styled.span`
  overflow: hidden;
  color: ${theme.colors.gray900};
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let SummaryMeta = styled.span<{ $warning?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${({ $warning }) => ($warning ? theme.colors.orange900 : theme.colors.gray650)};
  font-size: 12px;
  font-weight: ${({ $warning }) => ($warning ? 600 : 400)};

  svg {
    width: 13px;
    height: 13px;
  }
`;

let IssueList = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 6px 2px;
`;

let IssueRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 3px 8px;
  font-size: 12.5px;
`;

let IssueDot = styled.span<{ $color: string }>`
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
`;

let IssueTitle = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: ${theme.colors.gray900};
  text-overflow: ellipsis;
  white-space: nowrap;
`;

let IssueSeverity = styled.span`
  flex: 0 0 auto;
  color: ${theme.colors.gray650};
  font-size: 11px;
`;

let Footer = styled.div`
  display: flex;
  padding: 2px 6px 6px;
`;

let Placeholder = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray600};

  svg {
    width: 45%;
    height: 45%;
  }
`;

let ringPlaceholder = (
  <Placeholder>
    <RiShieldCheckLine />
  </Placeholder>
);

export let SecurityCardBody = (p: {
  security: SkillWorkspaceSecurity;
  onOpenReport: () => void;
}) => {
  let { security } = p;
  let listed = security.issues.slice(0, MAX_LISTED_ISSUES);
  let hidden = security.issues.length - listed.length;

  return (
    <>
      <Summary>
        <ScoreRing
          size={52}
          score={security.score}
          color={security.color}
          placeholder={ringPlaceholder}
        />

        <SummaryCopy>
          <SummaryTitle>{security.verdictLabel}</SummaryTitle>
          {security.issues.length ? (
            <SummaryMeta $warning>
              <RiAlertFill />
              {formatIssueCount(security.issues.length)} found
            </SummaryMeta>
          ) : (
            <SummaryMeta>
              {security.status == 'pending'
                ? 'Review in progress'
                : (security.scoreLabel ?? 'No issues found')}
            </SummaryMeta>
          )}
        </SummaryCopy>
      </Summary>

      {listed.length ? (
        <IssueList>
          {listed.map(issue => (
            <IssueRow key={issue.key}>
              <IssueDot $color={severityColors[issue.severity]} />
              <IssueTitle>{issue.title}</IssueTitle>
              <IssueSeverity>{severityLabels[issue.severity]}</IssueSeverity>
            </IssueRow>
          ))}
          {hidden > 0 ? (
            <IssueRow>
              <IssueSeverity>+{hidden} more</IssueSeverity>
            </IssueRow>
          ) : null}
        </IssueList>
      ) : null}

      <Footer>
        <SectionLinkButton type="button" onClick={p.onOpenReport}>
          View report
          <RiArrowRightSLine />
        </SectionLinkButton>
      </Footer>
    </>
  );
};

let IndicatorButton = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray250};
  }

  &:focus-visible {
    outline: 2px solid ${theme.colors.primary};
    outline-offset: 1px;
  }
`;

let WarningMark = styled.span`
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border: 2px solid ${theme.colors.background};
  border-radius: 999px;
  background: ${theme.colors.orange900};
  color: #fff;
  box-sizing: content-box;

  svg {
    width: 9px;
    height: 9px;
  }
`;

export let SecurityIndicator = (p: {
  security: SkillWorkspaceSecurity;
  active: boolean;
  onOpenReport: () => void;
}) => {
  let { security } = p;
  let hasIssues = security.issues.length > 0;
  let tooltip = hasIssues
    ? `${security.verdictLabel} · ${formatIssueCount(security.issues.length)}`
    : security.verdictLabel;

  return (
    <FloatingBar data-key="security" style={{ padding: 2 }}>
      <Tooltip content={tooltip}>
        <IndicatorButton
          aria-label={`Security report: ${tooltip}`}
          aria-pressed={p.active}
          type="button"
          onClick={p.onOpenReport}
          style={p.active ? { background: theme.colors.gray300 } : undefined}
        >
          <ScoreRing
            size={30}
            score={security.score}
            color={security.color}
            placeholder={ringPlaceholder}
          />
          {hasIssues ? (
            <WarningMark aria-hidden>
              <RiAlertFill />
            </WarningMark>
          ) : null}
        </IndicatorButton>
      </Tooltip>
    </FloatingBar>
  );
};
