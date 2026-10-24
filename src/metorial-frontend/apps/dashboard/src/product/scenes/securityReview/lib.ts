import type { SecurityReview, SecurityReviewRevision } from '@metorial/state';
import type { ColorType } from '@metorial/ui';
import type { SecurityLevel } from '@metorial/ui-product';

type Scores = NonNullable<SecurityReviewRevision['scores']>;
type Report = SecurityReviewRevision['report'];
type Finding = SecurityReviewRevision['findings'][number];

export type SecurityReviewTool = NonNullable<Report['capabilities']>['tools'][number];
export type SecurityReviewFinding = Finding;
export type CapabilityTag = SecurityReviewTool['tags'][number];
export type ReviewStage = NonNullable<SecurityReviewRevision['stage']>;

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

export let provenanceLabels: Record<NonNullable<Report['provenance']>['class'], string> = {
  metorial_built: 'Built and Operated by Metorial',
  tenant_code: 'Your Organization’s Code',
  tenant_image: 'Your Organization’s Container Image',
  tenant_remote_vendor_verified: 'Verified Vendor Endpoint',
  tenant_remote_vendor_plausible: 'Vendor Domain Only',
  tenant_remote_third_party: 'Third-Party Server',
  tenant_remote_unverifiable: 'Unverified Host',
  impersonation_suspected: 'Possible Impersonation'
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

export let triggerLabels: Record<SecurityReviewRevision['trigger'], string> = {
  first_use: 'First use',
  page_open: 'Initial assessment',
  new_version: 'New version',
  deployment: 'New deployment',
  tools_discovered: 'Tools discovered',
  census_changed: 'Tool specification changed',
  scheduled: 'Scheduled review',
  prompt_update: 'Method update',
  reassess: 'Reassessment'
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

export let isRevisionRunning = (revision: SecurityReviewRevision | null | undefined) =>
  revision?.status == 'queued' || revision?.status == 'running';

export let isDeterministicRevision = (revision: SecurityReviewRevision) =>
  !revision.aiGenerated ||
  revision.blockReason == 'ai_disabled' ||
  revision.blockReason == 'admin_disabled';

export let getReviewRevisions = (review: SecurityReview) => {
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

export let hasReportContent = (revision: SecurityReviewRevision) => {
  let report = revision.report;

  return !!(
    report.summary ||
    report.provenance ||
    report.capabilities ||
    report.implementation ||
    report.changes ||
    report.method ||
    revision.findings.length
  );
};
