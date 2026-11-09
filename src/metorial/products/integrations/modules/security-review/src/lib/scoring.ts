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

type KnownLevel = Exclude<SecurityLevel, 'unknown'>;

let LEVELS: KnownLevel[] = ['low', 'moderate', 'high', 'critical'];

let provenanceBase: Record<SecurityProvenanceClass, number> = {
  metorial_built: 95,
  tenant_code: 80,
  tenant_image: 65,
  tenant_remote_vendor_verified: 85,
  tenant_remote_vendor_plausible: 72,
  tenant_remote_third_party: 60,
  tenant_remote_unverifiable: 45,
  impersonation_suspected: 10,
  tenant_authored: 80,
  imported_public_repo: 75,
  imported_private_repo: 80,
  uploaded_archive: 70,
  forked: 78
};

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
  subagents: 'moderate',
  binary_payload: 'high',
  financial: 'critical'
};

let levelIndex = (level: KnownLevel) => LEVELS.indexOf(level);
let raise = (level: KnownLevel) => LEVELS[Math.min(levelIndex(level) + 1, LEVELS.length - 1)]!;
let maxLevel = (a: KnownLevel, b: KnownLevel) => (levelIndex(a) >= levelIndex(b) ? a : b);

export let isTenantProvenance = (provenance: SecurityProvenanceClass) =>
  provenance != 'metorial_built';

export let computeSecurityScore = (d: {
  provenance: SecurityProvenanceClass;
  findings: Pick<SecurityReportFinding, 'kind' | 'severity'>[];
}) => {
  let security = d.findings.filter(finding => finding.kind == 'security');
  let count = (severity: SecurityFindingSeverityLevel) =>
    security.filter(finding => finding.severity == severity).length;

  let score = provenanceBase[d.provenance];

  if (isTenantProvenance(d.provenance)) {
    let positives = d.findings.filter(finding => finding.kind == 'positive').length;
    score = Math.min(score + Math.min(positives * 2, 10), 98);
  }

  score -= count('high') * 15;
  score -= Math.min(count('medium') * 6, 24);
  score -= Math.min(count('low') * 2, 8);

  if (count('high') > 0) score = Math.min(score, 60);
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
  tools: Pick<SecurityReportTool, 'tags'>[] | null,
  behaviors?: Pick<SecurityReportBehavior, 'tag'>[]
) => {
  if (!tools) return { exposure: 'unknown' as SecurityLevel, trifecta: false };

  let tags = new Set(tools.flatMap(tool => tool.tags));
  let skillTags = new Set((behaviors ?? []).map(behavior => behavior.tag));
  let exposure: KnownLevel = 'low';
  for (let tag of tags) exposure = maxLevel(exposure, tagTiers[tag]);
  for (let tag of skillTags) exposure = maxLevel(exposure, skillTagTiers[tag]);

  let trifecta =
    (tags.has('untrusted_input') &&
      tags.has('bulk_private_data') &&
      tags.has('external_send')) ||
    (skillTags.has('network_egress') &&
      (skillTags.has('credential_access') || skillTags.has('filesystem_outside_skill')));
  if (trifecta) exposure = raise(exposure);

  return { exposure: exposure as SecurityLevel, trifecta };
};

export let computeRisk = (d: {
  postureRisk: KnownLevel;
  exposure: SecurityLevel;
  provenance?: SecurityProvenanceClass;
}) => {
  if (d.provenance == 'metorial_built') return d.postureRisk;

  let exposure: KnownLevel = d.exposure == 'unknown' ? 'moderate' : d.exposure;
  let risk = maxLevel(d.postureRisk, exposure);

  if (levelIndex(d.postureRisk) >= 1 && levelIndex(exposure) >= 1) risk = raise(risk);

  return risk;
};

export type ScoringCoverage = {
  toolsExpected: number | null;
  toolsReviewed: number;
  codeReadable?: boolean;
  vendorDocsReachable?: boolean;
  budgetExhausted: boolean;
  awaitingTools: boolean;
};

export let computeConfidence = (d: {
  provenance: SecurityProvenanceClass;
  coverage: ScoringCoverage;
}): SecurityConfidenceLevel => {
  let { coverage } = d;
  if (coverage.awaitingTools || coverage.budgetExhausted || coverage.toolsExpected === null) {
    return 'low';
  }

  let gaps = [
    coverage.toolsReviewed < coverage.toolsExpected,
    coverage.codeReadable === false,
    coverage.vendorDocsReachable === false
  ].filter(Boolean).length;

  let confidence: SecurityConfidenceLevel = gaps == 0 ? 'high' : gaps == 1 ? 'medium' : 'low';
  if (d.provenance == 'tenant_image' && confidence == 'high') confidence = 'medium';

  return confidence;
};

let trustLines: Record<SecurityBand, string> = {
  strong: 'Trusted implementation.',
  good: 'Solid implementation.',
  fair: 'Some security concerns.',
  weak: 'Significant security concerns.',
  poor: 'Serious security concerns.'
};

let exposureLines: Record<SecurityLevel, string> = {
  unknown: 'Tools not yet inspected.',
  low: 'Read-only access.',
  moderate: 'Can change your data.',
  high: 'Powerful permissions.',
  critical: 'Broad, powerful permissions.'
};

export let headlineFor = (d: {
  band: SecurityBand;
  exposure: SecurityLevel;
}): [string, string] => [trustLines[d.band], exposureLines[d.exposure]];

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
  let postureRisk = postureRiskForScore(security);
  let risk = computeRisk({ postureRisk, exposure, provenance: d.provenance });

  let securityFindings = d.findings.filter(finding => finding.kind == 'security');
  let countSeverity = (severity: SecurityFindingSeverityLevel) =>
    securityFindings.filter(finding => finding.severity == severity).length;
  let tools = d.tools ?? [];

  return {
    rulesVersion: SECURITY_REVIEW_RULES_VERSION,
    security,
    band,
    exposure,
    postureRisk,
    risk,
    confidence: computeConfidence({ provenance: d.provenance, coverage: d.coverage }),
    trifecta,
    headline: headlineFor({ band, exposure }),
    counts: {
      tools: { expected: d.coverage.toolsExpected ?? 0, reviewed: d.coverage.toolsReviewed },
      capabilities: {
        read: tools.filter(tool => !tool.tags.some(isMutatingTag)).length,
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
