import type {
  SecurityConfidenceLevel,
  SecurityFindingSeverityLevel,
  SecurityLevel,
  SecurityReportFinding,
  SecurityUsageComputedScores,
  SecurityUsageReport,
  SecurityUsageStats
} from '@metorial-subspace/db';
import { SECURITY_REVIEW_RULES_VERSION } from '../../definitions/versions';
import type { SecurityFindingOrigin } from '../assemble';
import { isMutatingTag } from '../evidence';
import { computeExposure } from '../scoring';

let HIGH_CONFIDENCE_CALLS = 500;
let MEDIUM_CONFIDENCE_CALLS = 50;

let exposureLines: Record<SecurityLevel, string> = {
  unknown: 'Not enough usage to judge.',
  low: 'Only read access was used.',
  moderate: 'Used tools that change data.',
  high: 'Used powerful tools.',
  critical: 'Used tools with broad, powerful permissions.'
};

let severities: SecurityFindingSeverityLevel[] = ['info', 'low', 'medium', 'high', 'critical'];

export let computeUsageScores = (d: {
  stats: SecurityUsageStats;
  findings: SecurityReportFinding[];
  budgetExhausted: boolean;
}): SecurityUsageComputedScores => {
  let usedTools = d.stats.tools.filter(tool => tool.calls > 0);
  let exposure: SecurityLevel = d.stats.calls
    ? computeExposure(usedTools).exposure
    : 'unknown';

  let confidence: SecurityConfidenceLevel =
    d.budgetExhausted ||
    usedTools.some(tool => tool.unclassified || !tool.tags.length) ||
    exposure == 'unknown'
      ? 'low'
      : d.stats.calls >= HIGH_CONFIDENCE_CALLS
        ? 'high'
        : d.stats.calls >= MEDIUM_CONFIDENCE_CALLS
          ? 'medium'
          : 'low';

  let allowed = d.stats.tools.filter(tool => tool.allowed);
  let securityFindings = d.findings.filter(finding => finding.kind == 'security');

  return {
    rulesVersion: SECURITY_REVIEW_RULES_VERSION,
    exposure,
    confidence,
    headline: [
      `${d.stats.calls.toLocaleString('en-US')} calls in ${d.stats.windowDays} days.`,
      exposureLines[exposure]
    ],
    counts: {
      toolsAllowed: allowed.length,
      toolsUsed: usedTools.length,
      toolsNeverUsed: allowed.filter(tool => tool.calls == 0).length,
      scopesGranted: d.stats.scopes.length,
      scopesUnused: d.stats.scopes.filter(scope => !scope.requiredByUsedTool).length,
      findings: Object.fromEntries(
        severities.map(severity => [
          severity,
          securityFindings.filter(finding => finding.severity == severity).length
        ])
      ) as Record<SecurityFindingSeverityLevel, number>
    },
    stats: d.stats
  };
};

export let hasMutatingUsage = (stats: SecurityUsageStats) =>
  stats.tools.some(tool => tool.calls > 0 && tool.tags.some(isMutatingTag));

export let assembleUsageReport = (d: {
  stats: SecurityUsageStats;
  recorded: SecurityReportFinding[];
  draft: Partial<SecurityUsageReport> | null;
  gaps: string[];
  budgetExhausted: boolean;
}) => {
  let agentFindings = d.draft?.findings ?? [];
  let recordedKeys = new Set(d.recorded.map(finding => finding.key));

  let findings: { finding: SecurityReportFinding; origin: SecurityFindingOrigin }[] = [
    ...agentFindings
      .filter(finding => !recordedKeys.has(finding.key))
      .map(finding => ({ finding, origin: 'agent' as const })),
    ...d.recorded.map(finding => ({ finding, origin: 'detector' as const }))
  ];

  let limitations = [...(d.draft?.method?.limitations ?? [])];
  if (!d.draft) limitations.push('The AI analysis of this usage did not complete.');
  if (d.budgetExhausted)
    limitations.push('The analysis ran out of budget before it finished.');
  for (let gap of d.gaps) limitations.push(gap);

  let report: SecurityUsageReport = {
    ...d.draft,
    findings: findings.map(entry => entry.finding),
    method: {
      included: d.draft?.method?.included ?? [
        'Aggregated tool usage, granted scopes, tool filters and ProtoGuard matches.'
      ],
      limitations
    }
  };

  let scores = computeUsageScores({
    stats: d.stats,
    findings: report.findings ?? [],
    budgetExhausted: d.budgetExhausted
  });

  return { report, scores, findings };
};
