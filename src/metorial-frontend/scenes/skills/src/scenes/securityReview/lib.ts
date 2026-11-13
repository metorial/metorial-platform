import type {
  SecurityReview,
  SecurityReviewRevision,
  SkillSecurityReview,
  SkillSecurityReviewRevision
} from '@metorial/state';
import type { ColorType } from '@metorial/ui';
import type { SecurityLevel } from '@metorial/ui-product';

export type AnySecurityReview = SecurityReview | SkillSecurityReview;

export type AnySecurityReviewRevision = SecurityReviewRevision | SkillSecurityReviewRevision;

type Scores = NonNullable<AnySecurityReviewRevision['scores']>;
type Report = SecurityReviewRevision['report'];
type Provenance = NonNullable<AnySecurityReviewRevision['report']['provenance']>;
type Finding = AnySecurityReviewRevision['findings'][number];

export type SecurityReviewTool = NonNullable<Report['capabilities']>['tools'][number];
export type SecurityReviewFinding = Finding;
export type CapabilityTag = SecurityReviewTool['tags'][number];
export type SkillBehavior = SkillSecurityReviewRevision['report']['behaviors'][number];
export type BehaviorTag = SkillBehavior['tag'];
export type ReviewStage = NonNullable<AnySecurityReviewRevision['stage']>;
export type SkillVerdict = SkillSecurityReview['verdict'];

export let isSkillRevision = (
  revision: AnySecurityReviewRevision
): revision is SkillSecurityReviewRevision =>
  revision.object == 'skill.security_review.revision';

export let isSkillReview = (review: AnySecurityReview): review is SkillSecurityReview =>
  review.object == 'skill.security_review';

export let getReviewSubject = (
  target: AnySecurityReview | AnySecurityReviewRevision
): 'provider' | 'skill' => (target.object.startsWith('skill.') ? 'skill' : 'provider');

export let getPreviousScore = (revision: AnySecurityReviewRevision) =>
  isSkillRevision(revision) ? null : (revision.scores?.previous ?? null);

export let bandLabels: Record<Scores['band'], string> = {
  strong: 'Strong',
  good: 'Good',
  fair: 'Fair',
  weak: 'Weak',
  poor: 'Poor'
};

export let bandColors: Record<Scores['band'], ColorType> = {
  strong: 'green',
  good: 'green',
  fair: 'yellow',
  weak: 'orange',
  poor: 'red'
};

export let levelLabels: Record<Scores['exposure'], string> = {
  unknown: 'Not Yet Inspected',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical'
};

export let confidenceLabels: Record<Scores['confidence'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

export let confidenceLevels: Record<Scores['confidence'], SecurityLevel> = {
  low: 'moderate',
  medium: 'unknown',
  high: 'unknown'
};

export let provenanceLabels: Record<Provenance['class'], string> = {
  metorial_built: 'Built and Operated by Metorial',
  tenant_code: 'Your Organization’s Code',
  tenant_image: 'Your Organization’s Container Image',
  tenant_remote_vendor_verified: 'Verified Vendor Endpoint',
  tenant_remote_vendor_plausible: 'Vendor Domain Only',
  tenant_remote_third_party: 'Third-Party Server',
  tenant_remote_unverifiable: 'Unverified Host',
  impersonation_suspected: 'Possible Impersonation',
  tenant_authored: 'Written in Your Organization',
  imported_public_repo: 'Imported From a Public Repository',
  imported_private_repo: 'Imported From a Private Repository',
  uploaded_archive: 'Uploaded Archive',
  forked: 'Forked Skill'
};

export let capabilityTags: Record<CapabilityTag, { label: string; level: SecurityLevel }> = {
  read: { label: 'Read', level: 'low' },
  write: { label: 'Write', level: 'moderate' },
  untrusted_input: { label: 'Untrusted Input', level: 'moderate' },
  destructive: { label: 'Destructive', level: 'high' },
  external_send: { label: 'External Send', level: 'high' },
  bulk_private_data: { label: 'Bulk Private Data', level: 'high' },
  access_control: { label: 'Access Control', level: 'critical' },
  financial: { label: 'Financial', level: 'critical' },
  code_execution: { label: 'Code Execution', level: 'critical' },
  infrastructure: { label: 'Infrastructure', level: 'critical' }
};

export let behaviorTags: Record<BehaviorTag, { label: string; level: SecurityLevel }> = {
  mcp_dependency: { label: 'MCP Dependency', level: 'low' },
  subagents: { label: 'Subagents', level: 'low' },
  network_egress: { label: 'Network Egress', level: 'moderate' },
  package_install: { label: 'Package Install', level: 'high' },
  filesystem_outside_skill: { label: 'Filesystem Outside Skill', level: 'high' },
  persistence: { label: 'Persistence', level: 'high' },
  binary_payload: { label: 'Binary Payload', level: 'high' },
  credential_access: { label: 'Credential Access', level: 'critical' },
  code_execution: { label: 'Code Execution', level: 'critical' },
  financial: { label: 'Financial', level: 'critical' }
};

export let skillVerdicts: Record<
  SkillVerdict,
  { label: string; color: ColorType; level: SecurityLevel }
> = {
  pass: { label: 'No Issues Found', color: 'green', level: 'low' },
  warn: { label: 'Review Recommended', color: 'yellow', level: 'moderate' },
  fail: { label: 'High Risk', color: 'red', level: 'critical' },
  pending: { label: 'Review Pending', color: 'gray', level: 'unknown' },
  unavailable: { label: 'Review Unavailable', color: 'gray', level: 'unknown' },
  dismissed: { label: 'Review Dismissed', color: 'gray', level: 'unknown' }
};

export let isAiReviewScheduled = (review: SkillSecurityReview) => {
  let current = review.currentRevision;

  return (
    review.verdict == 'pending' && !!current && !current.aiGenerated && !current.blockReason
  );
};

let levelRank: Record<SecurityLevel, number> = {
  unknown: 0,
  low: 1,
  moderate: 2,
  medium: 2,
  high: 3,
  critical: 4
};

export let getToolRank = (tool: SecurityReviewTool) =>
  Math.max(0, ...tool.tags.map(tag => levelRank[capabilityTags[tag].level]));

export let getBehaviorRank = (behavior: SkillBehavior) =>
  levelRank[behaviorTags[behavior.tag].level];

export let severityLabels: Record<Finding['severity'], string> = {
  info: 'Info',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical'
};

export let severityLevels: Record<Finding['severity'], SecurityLevel> = {
  info: 'unknown',
  low: 'low',
  medium: 'moderate',
  high: 'high',
  critical: 'critical'
};

export let findingKindLabels: Record<Finding['kind'], string> = {
  security: 'Security',
  capability: 'Capability',
  positive: 'Positive'
};

export let triggerLabels: Record<SkillSecurityReviewRevision['trigger'], string> = {
  first_use: 'First use',
  page_open: 'Initial assessment',
  new_version: 'New version',
  deployment: 'New deployment',
  tools_discovered: 'Tools discovered',
  census_changed: 'Tool specification changed',
  scheduled: 'Scheduled review',
  prompt_update: 'Method update',
  reassess: 'Reassessment',
  skill_import: 'Skill import'
};

export let reviewStages: {
  id: ReviewStage;
  label: string;
  description: string;
  title: string;
  detail: string;
}[] = [
  {
    id: 'collecting',
    label: 'Collect Evidence',
    description: 'Specification and authentication',
    title: 'Getting the full picture.',
    detail: 'Gathering the tool specification, authentication details, and version history.'
  },
  {
    id: 'verifying',
    label: 'Verify Publisher',
    description: 'Ownership and origin',
    title: 'Verifying who is behind it.',
    detail: 'Checking publisher identity, ownership, and authentication provenance.'
  },
  {
    id: 'analyzing',
    label: 'Review Capabilities',
    description: 'Tools and data access',
    title: 'Looking beyond the tool names.',
    detail: 'Reviewing permissions, dangerous operations, and how data is handled.'
  },
  {
    id: 'writing',
    label: 'Write Report',
    description: 'Score and findings',
    title: 'Turning evidence into a verdict.',
    detail: 'Validating findings, calculating the score, and writing the report.'
  }
];

export let usageReviewStages: typeof reviewStages = [
  {
    id: 'collecting',
    label: 'Gather Usage',
    description: 'Tools, scopes and filters',
    title: 'Looking at how it is used.',
    detail:
      'Reading aggregated tool usage, granted scopes, tool filters, and ProtoGuard results.'
  },
  {
    id: 'analyzing',
    label: 'Compare Access',
    description: 'Allowed versus used',
    title: 'Comparing what is allowed with what is used.',
    detail: 'Checking which powerful tools and scopes are available but never needed.'
  },
  {
    id: 'writing',
    label: 'Write Report',
    description: 'Exposure and findings',
    title: 'Turning usage into a verdict.',
    detail: 'Writing the observed exposure, findings and recommendations.'
  }
];

export let skillReviewStages: typeof reviewStages = [
  {
    id: 'collecting',
    label: 'Collect Files',
    description: 'Instructions, scripts, and assets',
    title: 'Getting the full picture.',
    detail: 'Gathering the skill instructions, scripts, and bundled files.'
  },
  {
    id: 'verifying',
    label: 'Verify Origin',
    description: 'Authorship and source',
    title: 'Verifying where it comes from.',
    detail: 'Checking who wrote the skill and where its files were imported from.'
  },
  {
    id: 'analyzing',
    label: 'Review Behaviors',
    description: 'What it makes an agent do',
    title: 'Looking beyond the instructions.',
    detail: 'Reviewing code execution, network access, credentials, and other behaviors.'
  },
  {
    id: 'writing',
    label: 'Write Report',
    description: 'Score and findings',
    title: 'Turning evidence into a verdict.',
    detail: 'Validating findings, calculating the score, and writing the report.'
  }
];

export let getReviewStages = (subject: 'provider' | 'skill') =>
  subject == 'skill' ? skillReviewStages : reviewStages;

export let isRevisionRunning = (revision: AnySecurityReviewRevision | null | undefined) =>
  revision?.status == 'queued' || revision?.status == 'running';

export let isDeterministicRevision = (revision: AnySecurityReviewRevision) =>
  !revision.aiGenerated ||
  revision.blockReason == 'ai_disabled' ||
  revision.blockReason == 'admin_disabled';

export let getReviewRevisions = <
  R extends AnySecurityReviewRevision = AnySecurityReviewRevision
>(review: {
  currentRevision: R | null;
  inProgressRevision: R | null;
}) => {
  let current = review.currentRevision;
  let inProgress = isRevisionRunning(review.inProgressRevision)
    ? review.inProgressRevision
    : null;
  let failed =
    review.inProgressRevision?.status == 'failed'
      ? review.inProgressRevision
      : current?.status == 'failed'
        ? current
        : null;

  return {
    current: current && current.status != 'failed' ? current : null,
    inProgress,
    failed
  };
};

export let hasReportContent = (revision: AnySecurityReviewRevision) => {
  let report = revision.report;
  let hasCapabilities = isSkillRevision(revision)
    ? revision.report.behaviors.length > 0
    : !!revision.report.capabilities;

  return !!(
    report.summary ||
    report.provenance ||
    hasCapabilities ||
    report.implementation ||
    report.changes ||
    report.method ||
    revision.findings.length
  );
};
