export type SecurityProvenanceClass =
  | 'metorial_built'
  | 'tenant_code'
  | 'tenant_image'
  | 'tenant_remote_vendor_verified'
  | 'tenant_remote_vendor_plausible'
  | 'tenant_remote_third_party'
  | 'tenant_remote_unverifiable'
  | 'impersonation_suspected'
  | 'tenant_authored'
  | 'imported_public_repo'
  | 'imported_private_repo'
  | 'uploaded_archive'
  | 'forked';

export type SecurityCapabilityTag =
  | 'read'
  | 'write'
  | 'untrusted_input'
  | 'destructive'
  | 'external_send'
  | 'bulk_private_data'
  | 'access_control'
  | 'financial'
  | 'code_execution'
  | 'infrastructure';

export type SecurityFindingCategoryKey =
  | 'provenance'
  | 'impersonation'
  | 'tool_poisoning'
  | 'secrets'
  | 'dependencies'
  | 'input_validation'
  | 'auth'
  | 'transport'
  | 'data_handling'
  | 'spec_variance'
  | 'annotation_mismatch'
  | 'excessive_scope'
  | 'capability'
  | 'implementation'
  | 'instruction_manipulation'
  | 'hidden_content'
  | 'remote_code'
  | 'remote_instructions'
  | 'exfiltration'
  | 'credentials'
  | 'supply_chain'
  | 'persistence'
  | 'over_privilege'
  | 'trigger_abuse'
  | 'agentic_abuse'
  | 'shadow_features'
  | 'opaque_content'
  | 'reviewer_targeting'
  | 'other';

export type SecuritySkillCapabilityTag =
  | 'code_execution'
  | 'network_egress'
  | 'filesystem_outside_skill'
  | 'credential_access'
  | 'package_install'
  | 'persistence'
  | 'mcp_dependency'
  | 'subagents'
  | 'binary_payload'
  | 'financial';

export type SecurityLevel = 'unknown' | 'low' | 'moderate' | 'high' | 'critical';

export type SecurityBand = 'strong' | 'good' | 'fair' | 'weak' | 'poor';

export type SecurityConfidenceLevel = 'low' | 'medium' | 'high';

export type SecurityFindingSeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SecurityLedgerRef =
  | { type: 'file'; path: string; lines?: number[] }
  | { type: 'url'; url: string }
  | { type: 'tool'; key: string }
  | { type: 'fact'; id: string };

export type SecurityToolHints = {
  readOnly?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  openWorld?: boolean;
};

export type SecurityReportTool = {
  key: string;
  name?: string;
  tags: SecurityCapabilityTag[];
  behavior: string;
  declaredHints: SecurityToolHints;
  hintAccuracy: 'matches' | 'mismatch' | 'undeclared';
};

export type SecurityReportBehavior = {
  tag: SecuritySkillCapabilityTag;
  body: string;
  evidence: SecurityLedgerRef[];
};

export type SecurityReportPoint = {
  title: string;
  body: string;
  evidence: SecurityLedgerRef[];
};

export type SecurityReportFinding = {
  key: string;
  kind: 'security' | 'capability' | 'positive';
  category: SecurityFindingCategoryKey;
  severity: SecurityFindingSeverityLevel;
  title: string;
  body: string;
  recommendation?: string;
  tools: string[];
  evidence: SecurityLedgerRef[];
};

export type SecurityReport = {
  summary?: { text: string; trustNote: string; exposureNote: string };
  provenance?: { class: SecurityProvenanceClass; body: string; evidence: SecurityLedgerRef[] };
  capabilities?: { tools: SecurityReportTool[]; behaviors?: SecurityReportBehavior[] };
  implementation?: { strengths: SecurityReportPoint[]; weaknesses: SecurityReportPoint[] };
  findings?: SecurityReportFinding[];
  resolvedFindings?: { key: string; reason: string }[];
  changes?: { body: string };
  method?: { included: string[]; outOfScope: string[]; limitations: string[] };
};

export type SecurityReportSectionName = keyof SecurityReport;

export type SecurityReviewScoreCounts = {
  tools: { expected: number; reviewed: number };
  capabilities: Record<'read' | 'write' | 'destructive', number>;
  findings: Record<SecurityFindingSeverityLevel, number>;
  positives: number;
};

export type SecurityReviewComputedScores = {
  rulesVersion: string;
  security: number;
  band: SecurityBand;
  exposure: SecurityLevel;
  postureRisk: Exclude<SecurityLevel, 'unknown'>;
  risk: Exclude<SecurityLevel, 'unknown'>;
  confidence: SecurityConfidenceLevel;
  trifecta: boolean;
  headline: [string, string];
  counts: SecurityReviewScoreCounts;
  delta?: { previousSecurity: number; previousRisk: SecurityLevel };
};

export type SecuritySpecCensusClassification =
  'stable' | 'evolved' | 'scoped_subset' | 'disjoint' | 'divergent_definitions';

export type SecuritySpecCensus = {
  classification: SecuritySpecCensusClassification;
  windowDays: number;
  computedAt: string;
  hashes: {
    hash: string;
    firstSeenAt: string;
    lastSeenAt: string;
    credentials: number;
    toolKeys: string[];
  }[];
  divergentTools: string[];
  addedTools: string[];
  removedTools: string[];
};

export type SecurityReviewFindingPayload = {
  title: string;
  body: string;
  recommendation?: string;
  tools: string[];
  evidence: SecurityLedgerRef[];
};

export type SecurityReviewRevisionContext = {
  reason?: string;
  previousRevisionId?: string;
  changes?: { type: string; detail: string }[];
  limitations?: string[];
  validationErrors?: string[];
  admin?: { actorId: string; action: 'edit' | 'rerun'; at: string };
  skill?: {
    skillVersionId: string;
    fileCount: number;
    analyzedFileCount: number;
    kinds: Record<string, number>;
    aiDeferredUntil?: string;
  };
};
