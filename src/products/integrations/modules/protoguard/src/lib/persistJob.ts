import type { CapabilityTag, ProjectedFinding, RetentionLevel, ScanCoverage } from './engine';

export type MessageScanDirection = 'input' | 'output';

// Everything in this job is already projected for the message's retention level. It sits in Redis
// while queued, so it must never carry the scanned payload itself.
export interface PersistMessageScanJob {
  messageId: string;
  directions: MessageScanDirection[];
  rulesetVersion: string;
  retentionLevel: RetentionLevel;

  coverage: ScanCoverage;
  skipReason: string | null;
  scannedChars: number;
  totalChars: number;
  durationMs: number;

  isToolCall: boolean;
  toolKey: string | null;
  capabilityTags: CapabilityTag[];

  findings: ProjectedFinding[];
}

let COVERAGE_RANK: Record<ScanCoverage, number> = {
  full: 0,
  sampled: 1,
  partial: 2,
  skipped: 3
};

export let mergeCoverage = (a: ScanCoverage | null | undefined, b: ScanCoverage) =>
  a && COVERAGE_RANK[a] > COVERAGE_RANK[b] ? a : b;
