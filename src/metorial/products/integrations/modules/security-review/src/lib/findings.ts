import { getId } from '@metorial-subspace/db';
import type {
  SecurityReportFinding,
  SecurityReviewFinding,
  SecurityReviewRevisionStatus
} from '@metorial-subspace/db';
import type { SecurityFindingOrigin } from './assemble';

export type StoredFinding = {
  finding: SecurityReportFinding;
  origin: SecurityFindingOrigin | 'previous';
  change: 'new' | 'persisting' | 'resolved';
  isLocked: boolean;
};

export type GlobalFinding = {
  key: string;
  kind: SecurityReportFinding['kind'];
  category: string;
  severity: SecurityReportFinding['severity'];
  change: StoredFinding['change'];
  origin: string;
  isLocked: boolean;
  value: Omit<SecurityReportFinding, 'key' | 'kind' | 'category' | 'severity'>;
};

export let isReportStatus = (status: SecurityReviewRevisionStatus) =>
  status == 'completed' || status == 'completed_with_gaps' || status == 'blocked';

export let toReportFinding = (row: SecurityReviewFinding): SecurityReportFinding => ({
  ...row.value,
  key: row.key,
  kind: row.kind,
  category: row.category as SecurityReportFinding['category'],
  severity: row.severity
});

export let toGlobalFindings = (findings: StoredFinding[]): GlobalFinding[] =>
  findings.map(({ finding, origin, change, isLocked }) => {
    let { key, kind, category, severity, ...value } = finding;

    return { key, kind, category, severity, change, origin, isLocked, value };
  });

export let toFindingRows = (findings: StoredFinding[], revisionOid: bigint) =>
  findings.map(entry => ({
    ...getId('securityReviewFinding'),
    revisionOid,
    key: entry.finding.key,
    kind: entry.finding.kind,
    category: entry.finding.category,
    severity: entry.finding.severity,
    change: entry.change,
    origin: entry.origin,
    isLocked: entry.isLocked,
    value: {
      title: entry.finding.title,
      body: entry.finding.body,
      recommendation: entry.finding.recommendation,
      tools: entry.finding.tools,
      evidence: entry.finding.evidence
    }
  }));

export let classifyFindings = (d: {
  findings: { finding: SecurityReportFinding; origin: SecurityFindingOrigin }[];
  previous: SecurityReviewFinding[];
  lockedKeys: Set<string>;
}): StoredFinding[] => {
  let previousKeys = new Set(
    d.previous.filter(finding => finding.change != 'resolved').map(finding => finding.key)
  );
  let currentKeys = new Set(d.findings.map(entry => entry.finding.key));

  let current = d.findings.map(entry => ({
    ...entry,
    change: previousKeys.has(entry.finding.key) ? ('persisting' as const) : ('new' as const),
    isLocked: d.lockedKeys.has(entry.finding.key)
  }));

  let resolved = d.previous
    .filter(
      finding =>
        finding.kind == 'security' &&
        finding.change != 'resolved' &&
        !currentKeys.has(finding.key)
    )
    .map(finding => ({
      finding: toReportFinding(finding),
      origin: 'previous' as const,
      change: 'resolved' as const,
      isLocked: false
    }));

  return [...current, ...resolved];
};
