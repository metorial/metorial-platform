import type {
  ProtoGuardIssueType,
  ProtoGuardSeverity,
  SessionMessage
} from '@metorial-subspace/db';

export interface ProtoGuardScanTarget {
  path: string;
  content: string;
}

export interface ProtoGuardCheckContext {
  message: SessionMessage;
  targets: ProtoGuardScanTarget[];
}

export interface ProtoGuardMatch {
  path: string;
  startOffset: number;
  endOffset: number;
  matchedText: string;
  confidence: number;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ProtoGuardCheckResult {
  matches: ProtoGuardMatch[];
}

export interface ProtoGuardFilterDefinition {
  key: string;
  name: string;
  description: string;
  issueType: ProtoGuardIssueType;
  severity: ProtoGuardSeverity;
  scoreWeight: number;
  defaultEnabled: boolean;
  alertConfidenceThreshold: number;
  check: (ctx: ProtoGuardCheckContext) => ProtoGuardCheckResult;
}

export interface ProtoGuardEffectiveFilter {
  definition: ProtoGuardFilterDefinition;
  filterOid: bigint;
  alertConfidenceThreshold: number;
}

export interface ProtoGuardScoredMatch extends ProtoGuardMatch {
  filterKey: string;
  filterOid: bigint;
  filterName: string;
  issueType: ProtoGuardIssueType;
  severity: ProtoGuardSeverity;
  scoreWeight: number;
  alertConfidenceThreshold: number;
  sampleMarkdown: string;
}

export interface ProtoGuardScoreResult {
  score: number;
  maxScore: number;
  confidence: number;
  triggeredFilterCount: number;
  matchedInstanceCount: number;
  shouldAlert: boolean;
  alertByConfidence: boolean;
  alertByFilterCount: boolean;
  matches: ProtoGuardScoredMatch[];
  issueTypes: ProtoGuardIssueType[];
}
