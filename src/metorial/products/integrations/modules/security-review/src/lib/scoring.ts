import type {
  SecurityBand,
  SecurityCapabilityTag,
  SecurityConfidenceLevel,
  SecurityControlDisposition,
  SecurityFindingCategoryKey,
  SecurityFindingSeverityLevel,
  SecurityLevel,
  SecurityProvenanceClass,
  SecurityReportBehavior,
  SecurityReportFinding,
  SecurityReportTool,
  SecurityReportControl,
  SecuritySkillCapabilityTag,
  SecurityReviewComputedScores
} from '@metorial-subspace/db';
import { controlWeight } from '../definitions/controls';
import { SECURITY_REVIEW_RULES_VERSION } from '../definitions/versions';
import { isMutatingTag } from './evidence';
import { actionExposure, actionsExposure, highestExposure } from './actionRules';

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

let SEVERITY_WEIGHTS: Record<SecurityFindingSeverityLevel, number> = {
  info: 0,
  low: 0.015,
  medium: 0.05,
  high: 0.55,
  critical: 0.8
};
let REPEAT_DECAY = 0.85;
let DECEPTION_WEIGHT = 0.95;
let IMPERSONATION_WEIGHT = 0.97;
let OPERATOR_TRUST: Partial<
  Record<SecurityProvenanceClass, { scale: number; exponent: number }>
> = { metorial_built: { scale: 0.1, exponent: 0.5 } };
let HARDENING_HEADROOM = 0.12;
let EXPOSURE_FACTORS: Record<SecurityLevel, number> = {
  unknown: 1,
  low: 0.5,
  moderate: 0.75,
  high: 1,
  critical: 1.25
};
let GAP_SIZES: Record<SecurityControlDisposition, number> = {
  met: 0,
  partial: 0.5,
  not_met: 1,
  not_applicable: 0
};
let REACH_WEIGHTS: Record<KnownLevel, number> = {
  low: 0.002,
  moderate: 0.012,
  high: 0.04,
  critical: 0.08
};
let REACH_HEADROOM = 0.2;
let ASSURANCE_LOSS = {
  incomplete: 0.06,
  unresolvedObservation: 0.02,
  unclassifiedActions: 0.03
};
let PROVENANCE_ASSURANCE_LOSS: Partial<Record<SecurityProvenanceClass, number>> = {
  tenant_remote_unverifiable: 0.04,
  tenant_image: 0.03,
  tenant_remote_third_party: 0.02,
  tenant_remote_vendor_plausible: 0.01
};

let ROUNDING_TOLERANCE = 1e-9;

let deceptiveCategories: SecurityFindingCategoryKey[] = [
  'impersonation',
  'tool_poisoning',
  'reviewer_targeting'
];

let severityRank: Record<SecurityFindingSeverityLevel, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

let levelIndex = (level: KnownLevel) => LEVELS.indexOf(level);
let raise = (level: KnownLevel) => LEVELS[Math.min(levelIndex(level) + 1, LEVELS.length - 1)]!;

let isDeception = (finding: Pick<SecurityReportFinding, 'category' | 'severity'>) =>
  (deceptiveCategories.includes(finding.category) &&
    severityRank[finding.severity] >= severityRank.medium) ||
  (finding.category == 'exfiltration' && severityRank[finding.severity] >= severityRank.high);

// Every factor is the share of trust that survives one source of residual risk. Multiplying
// them lets several serious defects compound towards zero without caps, while a clean subject
// keeps nearly all of its score.
export let findingsFactor = (d: {
  provenance: SecurityProvenanceClass;
  findings: Pick<SecurityReportFinding, 'kind' | 'severity' | 'category'>[];
}) => {
  let repeats: Partial<Record<SecurityFindingSeverityLevel, number>> = {};
  let factor = d.provenance == 'impersonation_suspected' ? 1 - IMPERSONATION_WEIGHT : 1;

  let ordered = d.findings
    .filter(finding => finding.kind == 'security')
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  for (let finding of ordered) {
    if (isDeception(finding)) {
      factor *= 1 - DECEPTION_WEIGHT;
      continue;
    }

    let seen = repeats[finding.severity] ?? 0;
    repeats[finding.severity] = seen + 1;
    let decay =
      finding.severity == 'low' || finding.severity == 'medium' ? REPEAT_DECAY ** seen : 1;
    factor *= 1 - SEVERITY_WEIGHTS[finding.severity] * decay;
  }

  return factor;
};

export let hardeningFactor = (d: {
  controls: Pick<SecurityReportControl, 'key' | 'disposition'>[];
  exposure: SecurityLevel;
}) => {
  let applicable = d.controls.filter(control => control.disposition != 'not_applicable');
  let total = applicable.reduce((sum, control) => sum + controlWeight(control.key), 0);
  if (!total) return 1;

  let gap =
    applicable.reduce(
      (sum, control) => sum + controlWeight(control.key) * GAP_SIZES[control.disposition],
      0
    ) / total;

  return 1 - HARDENING_HEADROOM * EXPOSURE_FACTORS[d.exposure] * gap;
};

// Every capability is a place where an undetected defect or a manipulated agent can do harm, so
// a well-built subject that can do more keeps more residual risk. Each further tool carrying the
// same capability adds less, so breadth matters without letting tool count dominate.
export let reachIndex = (d: {
  tools: Pick<SecurityReportTool, 'tags'>[] | null;
  behaviors?: Pick<SecurityReportBehavior, 'tag'>[];
}) => {
  let capabilities = [
    ...(d.tools ?? []).flatMap(tool =>
      tool.tags.map(tag => ({ key: `tool:${tag}`, level: tagTiers[tag] }))
    ),
    ...(d.behaviors ?? []).map(behavior => ({
      key: `skill:${behavior.tag}`,
      level: skillTagTiers[behavior.tag]
    }))
  ];
  let repeats: Record<string, number> = {};
  let retained = 1;

  for (let capability of capabilities) {
    let seen = repeats[capability.key] ?? 0;
    repeats[capability.key] = seen + 1;
    retained *= 1 - REACH_WEIGHTS[capability.level] * REPEAT_DECAY ** seen;
  }

  return 1 - retained;
};

export let assuranceFactor = (d: {
  provenance: SecurityProvenanceClass;
  complete: boolean;
  unresolvedObservations: number;
  unclassifiedActions: boolean;
}) => {
  if (d.provenance == 'metorial_built') return 1;

  return (
    (d.complete ? 1 : 1 - ASSURANCE_LOSS.incomplete) *
    (1 - ASSURANCE_LOSS.unresolvedObservation) ** d.unresolvedObservations *
    (d.unclassifiedActions ? 1 - ASSURANCE_LOSS.unclassifiedActions : 1) *
    (1 - (PROVENANCE_ASSURANCE_LOSS[d.provenance] ?? 0))
  );
};

// Metorial operates and remediates its own integrations through its release pipeline, so their
// defects are compressed and they never leave the top of the scale. The top of the scale is
// earned by being both defect-free and narrow in reach, which is what orders them.
let trustedScore = (d: {
  provenance: SecurityProvenanceClass;
  retained: number;
  reach: number;
}) => {
  let trust = OPERATOR_TRUST[d.provenance];
  if (!trust) return d.retained * (1 - REACH_HEADROOM * d.reach);

  let earned = (1 - (1 - d.retained) ** trust.exponent) * (1 - d.reach);
  return 1 - trust.scale * (1 - earned);
};

export let computeSecurityScore = (d: {
  provenance: SecurityProvenanceClass;
  findings: Pick<SecurityReportFinding, 'kind' | 'severity' | 'category'>[];
  controls?: Pick<SecurityReportControl, 'key' | 'disposition'>[];
  exposure?: SecurityLevel;
  reach?: number;
  assurance?: number;
}) => {
  let retained =
    findingsFactor(d) *
    hardeningFactor({ controls: d.controls ?? [], exposure: d.exposure ?? 'unknown' }) *
    (d.assurance ?? 1);
  let score = 100 * trustedScore({ provenance: d.provenance, retained, reach: d.reach ?? 0 });

  return Math.max(0, Math.min(100, Math.ceil(score - ROUNDING_TOLERANCE)));
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
  score >= 80 ? 'low' : score >= 60 ? 'moderate' : score >= 35 ? 'high' : 'critical';

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

let isCoverageComplete = (coverage: ScoringCoverage) =>
  coverage.assessmentComplete !== false &&
  coverage.contentComplete !== false &&
  !coverage.unresolvedObservations &&
  !coverage.awaitingTools &&
  !coverage.budgetExhausted &&
  coverage.toolsExpected !== null &&
  coverage.toolsReviewed >= coverage.toolsExpected &&
  coverage.codeReadable !== false;

export let computeConfidence = (d: {
  provenance: SecurityProvenanceClass;
  coverage: ScoringCoverage;
}): SecurityConfidenceLevel => {
  if (!isCoverageComplete(d.coverage) || d.coverage.vendorDocsReachable === false)
    return 'low';

  if (d.provenance == 'tenant_remote_unverifiable' || d.provenance == 'tenant_image')
    return 'low';
  if (['tenant_remote_vendor_plausible', 'tenant_remote_third_party'].includes(d.provenance)) {
    return 'medium';
  }

  return 'high';
};

let trustLines: Record<SecurityBand, string> = {
  strong: 'Strong security quality.',
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
  securityFindingCount: number;
  provenance?: SecurityProvenanceClass;
}): [string, string] => [
  d.band == 'strong' && d.securityFindingCount == 0
    ? 'No security issues found.'
    : trustLines[d.band],
  (d.provenance && skillProvenanceClasses.includes(d.provenance)
    ? skillExposureLines
    : exposureLines)[d.exposure]
];

export let computeScores = (d: {
  provenance: SecurityProvenanceClass;
  tools: SecurityReportTool[] | null;
  behaviors?: SecurityReportBehavior[];
  findings: SecurityReportFinding[];
  controls?: SecurityReportControl[];
  coverage: ScoringCoverage;
  previous?: { security: number; risk: SecurityLevel };
}): SecurityReviewComputedScores => {
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
  let unclassifiedActions =
    exposure == 'unknown' ||
    [
      ...(d.tools ?? []).flatMap(tool => tool.actions ?? []),
      ...(d.behaviors ?? []).flatMap(behavior => behavior.actions ?? [])
    ].some(action => actionExposure(action) == 'unknown');

  let controls = d.controls ?? [];
  let security = computeSecurityScore({
    provenance: d.provenance,
    findings: d.findings,
    controls,
    exposure,
    reach: reachIndex({ tools: d.tools, behaviors: d.behaviors }),
    assurance: assuranceFactor({
      provenance: d.provenance,
      complete: isCoverageComplete(d.coverage),
      unresolvedObservations: d.coverage.unresolvedObservations ?? 0,
      unclassifiedActions
    })
  });
  let band = bandForScore(security);
  let postureRisk = postureRiskForScore(security);
  let risk = computeRisk({ postureRisk, exposure, provenance: d.provenance });

  let securityFindings = d.findings.filter(finding => finding.kind == 'security');
  let countSeverity = (severity: SecurityFindingSeverityLevel) =>
    securityFindings.filter(finding => finding.severity == severity).length;
  let countControls = (disposition: SecurityControlDisposition) =>
    controls.filter(control => control.disposition == disposition).length;
  let tools = d.tools ?? [];
  let confidence = computeConfidence({ provenance: d.provenance, coverage: d.coverage });
  if (unclassifiedActions) confidence = 'low';

  let assessmentComplete = isCoverageComplete(d.coverage);
  let headline = headlineFor({
    band,
    exposure,
    securityFindingCount: securityFindings.length,
    provenance: d.provenance
  });
  if (!assessmentComplete) headline[0] = 'Partial assessment';

  return {
    rulesVersion: SECURITY_REVIEW_RULES_VERSION,
    security,
    band,
    exposure,
    postureRisk,
    risk,
    confidence,
    trifecta,
    assessmentComplete,
    headline,
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
      positives: d.findings.filter(finding => finding.kind == 'positive').length,
      controls: {
        met: countControls('met'),
        partial: countControls('partial'),
        not_met: countControls('not_met'),
        not_applicable: countControls('not_applicable')
      }
    },
    delta: d.previous
      ? { previousSecurity: d.previous.security, previousRisk: d.previous.risk }
      : undefined
  };
};
