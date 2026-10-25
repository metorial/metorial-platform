import type {
  SecurityReport,
  SecurityReviewBlockReason,
  SecurityReviewComputedScores,
  SecurityReviewMode,
  SecurityReviewRevisionContext,
  SecurityReviewRevisionStatus,
  SecurityReviewStage,
  SecurityReviewThoroughness,
  SecurityReviewTrigger,
  SecuritySpecCensus
} from '@metorial-subspace/db';
import type { StoredFinding } from './findings';

export type SecurityReviewRunInput = {
  reviewId: string;
  trigger: SecurityReviewTrigger;
  reason?: string;
  changes?: { type: string; detail: string }[];
  force?: boolean;
  recheck?: boolean;
  deterministicOnly?: boolean;
  admin?: {
    actorId: string;
    mode?: SecurityReviewMode;
    thoroughness?: SecurityReviewThoroughness;
  };
};

export type RevisionStart = {
  trigger: SecurityReviewTrigger;
  mode: SecurityReviewMode;
  thoroughness: SecurityReviewThoroughness;
  context: SecurityReviewRevisionContext;
  workspaceKey: string;
  skillVersionId?: string;
};

export type RevisionProgress = {
  stage?: SecurityReviewStage;
  activity?: string;
  report?: SecurityReport;
  scores?: SecurityReviewComputedScores;
};

export type RevisionCompletion = {
  status: SecurityReviewRevisionStatus;
  mode: SecurityReviewMode;
  blockReason?: SecurityReviewBlockReason;
  failureCode?: string;
  report: SecurityReport;
  scores: SecurityReviewComputedScores;
  findings: StoredFinding[];
  census?: SecuritySpecCensus;
  evidenceHash: string;
  contentHash?: string;
  awaitingTools: boolean;
  specificationOid?: bigint;
  context: SecurityReviewRevisionContext;
  model?: string;
  costMicros: number;
};

export let revisionSummaryColumns = (d: {
  scores: SecurityReviewComputedScores;
  report: SecurityReport;
}) => ({
  securityScore: d.scores.security,
  exposure: d.scores.exposure,
  risk: d.scores.risk,
  confidence: d.scores.confidence,
  provenanceClass: d.report.provenance?.class ?? null
});
