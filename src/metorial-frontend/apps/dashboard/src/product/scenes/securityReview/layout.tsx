import { theme } from '@metorial/ui';
import { styled } from 'styled-components';
import type { ReportContentsEntry } from './aside';
import { isSkillRevision, type AnySecurityReviewRevision } from './lib';
import {
  CapabilitiesSection,
  ChangesSection,
  FindingsSection,
  ImplementationSection,
  MethodSection,
  ProvenanceSection
} from './report';

export let SecurityReportHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
`;

export let SecurityReportHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export let SecurityReportLayout = styled.div`
  display: grid;
  align-items: start;
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
  gap: 48px;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
`;

export let SecurityReportVerdict = styled.article`
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  box-shadow: ${theme.shadows.small};
  background: ${theme.colors.background};
  padding: 20px;
  scroll-margin-top: 80px;
`;

export let SecurityReportVerdictHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
`;

export let SecurityReportVerdictFooter = styled.div`
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid ${theme.colors.gray300};
`;

let numbered = (index: number) => String(index + 1).padStart(2, '0');

export let SecurityReportSections = ({
  revision
}: {
  revision: AnySecurityReviewRevision;
}) => {
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

export let getSecurityReportContents = (
  revision: AnySecurityReviewRevision
): ReportContentsEntry[] => {
  let isSkill = isSkillRevision(revision);

  return [
    { id: 'verdict', label: 'Verdict' },
    { id: 'provenance', label: isSkill ? 'Origin & provenance' : 'Publisher & provenance' },
    ...(revision.report.implementation
      ? [{ id: 'implementation', label: 'Implementation review' }]
      : []),
    {
      id: 'capabilities',
      label: isSkill ? 'Behaviors & exposure' : 'Capabilities & exposure'
    },
    { id: 'findings', label: 'Findings' },
    { id: 'changes', label: 'What changed' },
    { id: 'method', label: 'Method & limits' }
  ];
};
