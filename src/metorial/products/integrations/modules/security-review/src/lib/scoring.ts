import type {
  SecurityBand,
  SecurityCapabilityTag,
  SecurityConfidenceLevel,
  SecurityFindingSeverityLevel,
  SecurityLevel,
  SecurityProvenanceClass,
  SecurityReportBehavior,
  SecurityReportFinding,
  SecurityReportTool,
  SecuritySkillCapabilityTag,
  SecurityReviewComputedScores
} from '@metorial-subspace/db';
import { SECURITY_REVIEW_RULES_VERSION } from '../definitions/versions';
import { isMutatingTag } from './evidence';
import { actionsExposure, highestExposure } from './actionRules';

type KnownLevel = Exclude<SecurityLevel, 'unknown'>;

let LEVELS: KnownLevel[] = ['low', 'moderate', 'high', 'critical'];

let tagTiers: Record<SecurityCapabilityTag, KnownLevel> = {
  read: 'low',
  write: 'moderate',
  untrusted_input: 'moderate',
  destructive: 'high',
  external_send: 'high',
  bulk_private_data: 'high',
  access_control: 'critical',
  financial: 'critical',
  code_execution: 'critical',
  infrastructure: 'critical'
};

let skillTagTiers: Record<SecuritySkillCapabilityTag, KnownLevel> = {
  code_execution: 'high',
  network_egress: 'moderate',
  filesystem_outside_skill: 'high',
  credential_access: 'high',
  package_install: 'moderate',
  persistence: 'high',
  mcp_dependency: 'moderate',
  subagents: 'low',
  binary_payload: 'high',
  financial: 'critical'
};

let levelIndex = (level: KnownLevel) => LEVELS.indexOf(level);
let raise = (level: KnownLevel) => LEVELS[Math.min(levelIndex(level) + 1, LEVELS.length - 1)]!;
export let computeSecurityScore = (d: {
  provenance: SecurityProvenanceClass;
  findings: Pick<SecurityReportFinding, 'kind' | 'severity'>[];
}) => {
  let security = d.findings.filter(finding => finding.kind == 'security');
  let count = (severity: SecurityFindingSeverityLevel) =>
    security.filter(finding => finding.severity == severity).length;

  let score = d.provenance == 'impersonation_suspected' ? 10 : 95;

  score -= count('high') * 15;
  score -= Math.min(count('medium') * 6, 24);
  score -= Math.min(count('low') * 2, 8);

  if (count('high') > 0) score = Math.min(score, 55);
  if (count('critical') > 0) score = Math.min(score, 25);
  if (d.provenance == 'impersonation_suspected') score = Math.min(score, 10);

  return Math.max(0, Math.min(100, Math.round(score)));
};

export let bandForScore = (score: number): SecurityBand =>
  score >= 90
    ? 'strong'
    : score >= 75
      ? 'good'
      : score >= 60
        ? 'fair'
        : score >= 40
          ? 'weak'
          : 'poor';

export let postureRiskForScore = (score: number): KnownLevel =>
  score >= 85 ? 'low' : score >= 70 ? 'moderate' : score >= 50 ? 'high' : 'critical';

export let computeExposure = (
  tools:
    | (Pick<SecurityReportTool, 'tags'> &
        Partial<Pick<SecurityReportTool, 'actions' | 'unclassified'>>)[]
    | null,
  behaviors?: (Pick<SecurityReportBehavior, 'tag'> &
    Partial<Pick<SecurityReportBehavior, 'actions' | 'unclassified'>>)[]
) => {
  if (!tools) return { exposure: 'unknown' as SecurityLevel, trifecta: false };

  let tags = new Set(tools.flatMap(tool => tool.tags));
  let skillTags = new Set((behaviors ?? []).map(behavior => behavior.tag));
  let levels = [
    ...tools.map(tool =>
      tool.actions?.length
        ? actionsExposure(tool.actions)
        : tool.unclassified
          ? highestExposure([...tool.tags.map(tag => tagTiers[tag]), 'unknown'])
          : !tool.tags.length
            ? ('unknown' as const)
            : highestExposure(tool.tags.map(tag => tagTiers[tag]))
    ),
    ...(behaviors ?? []).map(behavior =>
      behavior.actions?.length
        ? actionsExposure(behavior.actions)
        : behavior.unclassified
          ? ('unknown' as const)
          : skillTagTiers[behavior.tag]
    )
  ];
  let exposure = highestExposure(levels);
  let actions = [
    ...tools.flatMap(tool => tool.actions ?? []),
    ...(behaviors ?? []).flatMap(behavior => behavior.actions ?? [])
  ];
  let hasStructuredActions =
    tools.some(tool => tool.actions?.length) ||
    (behaviors ?? []).some(behavior => behavior.actions?.length);
  let trifecta = hasStructuredActions
    ? actions.some(
        action =>
          ['read', 'credentials'].includes(action.operation) &&
          ['private', 'credentials'].includes(action.data)
      ) &&
      actions.some(action => action.operation == 'send' && action.destination == 'arbitrary')
    : (tags.has('untrusted_input') &&
        tags.has('bulk_private_data') &&
        tags.has('external_send')) ||
      (skillTags.has('network_egress') &&
        (skillTags.has('credential_access') || skillTags.has('filesystem_outside_skill')));
  if (trifecta && exposure != 'unknown') exposure = raise(exposure);

  return { exposure: exposure as SecurityLevel, trifecta };
};

export let computeRisk = (d: {
  postureRisk: KnownLevel;
  exposure: SecurityLevel;
  provenance?: SecurityProvenanceClass;
}) => {
  return d.postureRisk;
};

export type ScoringCoverage = {
  toolsExpected: number | null;
  toolsReviewed: number;
  codeReadable?: boolean;
  vendorDocsReachable?: boolean;
  budgetExhausted: boolean;
  awaitingTools: boolean;
  assessmentComplete?: boolean;
  contentComplete?: boolean;
  unresolvedObservations?: number;
};

export let computeConfidence = (d: {
  provenance: SecurityProvenanceClass;
  coverage: ScoringCoverage;
}): SecurityConfidenceLevel => {
  let { coverage } = d;
  if (
    coverage.assessmentComplete === false ||
    coverage.contentComplete === false ||
    coverage.unresolvedObservations ||
    coverage.awaitingTools ||
    coverage.budgetExhausted ||
    coverage.toolsExpected === null
  ) {
    return 'low';
  }

  let gaps = [
    coverage.toolsReviewed < coverage.toolsExpected,
    coverage.codeReadable === false,
    coverage.vendorDocsReachable === false
  ].filter(Boolean).length;

  let confidence: SecurityConfidenceLevel = gaps == 0 ? 'high' : 'low';
  if (
    ['tenant_remote_vendor_plausible', 'tenant_remote_third_party'].includes(d.provenance) &&
    confidence == 'high'
  )
    confidence = 'medium';
  if (d.provenance == 'tenant_remote_unverifiable') confidence = 'low';
  if (d.provenance == 'tenant_image') confidence = 'low';

  return confidence;
};

let trustLines: Record<SecurityBand, string> = {
  strong: 'No security issues found.',
  good: 'Solid implementation.',
  fair: 'Some security concerns.',
  weak: 'Significant security concerns.',
  poor: 'Serious security concerns.'
};

let exposureLines: Record<SecurityLevel, string> = {
  unknown: 'Tools not yet inspected.',
  low: 'Limited, scoped access.',
  moderate: 'Can change your data.',
  high: 'Powerful permissions.',
  critical: 'Broad, powerful permissions.'
};

let skillExposureLines: Record<SecurityLevel, string> = {
  ...exposureLines,
  low: 'Limited, scoped behavior.'
};

let skillProvenanceClasses: SecurityProvenanceClass[] = [
  'tenant_authored',
  'imported_public_repo',
  'imported_private_repo',
  'uploaded_archive',
  'forked'
];

export let headlineFor = (d: {
  band: SecurityBand;
  exposure: SecurityLevel;
  provenance?: SecurityProvenanceClass;
}): [string, string] => [
  trustLines[d.band],
  (d.provenance && skillProvenanceClasses.includes(d.provenance)
    ? skillExposureLines
    : exposureLines)[d.exposure]
];

export let computeScores = (d: {
  provenance: SecurityProvenanceClass;
  tools: SecurityReportTool[] | null;
  behaviors?: SecurityReportBehavior[];
  findings: SecurityReportFinding[];
  coverage: ScoringCoverage;
  previous?: { security: number; risk: SecurityLevel };
}): SecurityReviewComputedScores => {
  let security = computeSecurityScore({ provenance: d.provenance, findings: d.findings });
  let band = bandForScore(security);
  let { exposure, trifecta } = computeExposure(d.tools, d.behaviors);
  if (
    d.findings.some(
      finding =>
        finding.kind == 'security' &&
        finding.category == 'exfiltration' &&
        finding.severity == 'critical'
    )
  )
    exposure = 'critical';
  let postureRisk = postureRiskForScore(security);
  let risk = computeRisk({ postureRisk, exposure, provenance: d.provenance });

  let securityFindings = d.findings.filter(finding => finding.kind == 'security');
  let countSeverity = (severity: SecurityFindingSeverityLevel) =>
    securityFindings.filter(finding => finding.severity == severity).length;
  let tools = d.tools ?? [];
  let confidence = computeConfidence({ provenance: d.provenance, coverage: d.coverage });
  if (
    exposure == 'unknown' ||
    [
      ...(d.tools ?? []).flatMap(tool => tool.actions ?? []),
      ...(d.behaviors ?? []).flatMap(behavior => behavior.actions ?? [])
    ].some(
      action =>
        action.scope == 'unknown' ||
        action.data == 'unknown' ||
        action.destination == 'unknown'
    )
  )
    confidence = 'low';

  return {
    rulesVersion: SECURITY_REVIEW_RULES_VERSION,
    security,
    band,
    exposure,
    postureRisk,
    risk,
    confidence,
    trifecta,
    assessmentComplete: d.coverage.assessmentComplete !== false && confidence != 'low',
    headline:
      confidence == 'low'
        ? ['Assessment incomplete.', 'Some behavior remains unclassified.']
        : headlineFor({ band, exposure, provenance: d.provenance }),
    counts: {
      tools: { expected: d.coverage.toolsExpected ?? 0, reviewed: d.coverage.toolsReviewed },
      capabilities: {
        read: tools.filter(
          tool => tool.tags.includes('read') && !tool.tags.some(isMutatingTag)
        ).length,
        write: tools.filter(
          tool => tool.tags.includes('write') && !tool.tags.includes('destructive')
        ).length,
        destructive: tools.filter(tool => tool.tags.includes('destructive')).length
      },
      findings: {
        info: countSeverity('info'),
        low: countSeverity('low'),
        medium: countSeverity('medium'),
        high: countSeverity('high'),
        critical: countSeverity('critical')
      },
      positives: d.findings.filter(finding => finding.kind == 'positive').length
    },
    delta: d.previous
      ? { previousSecurity: d.previous.security, previousRisk: d.previous.risk }
      : undefined
  };
};
