import type { SecurityReport } from '@metorial-subspace/db';
import type { EvidenceLedger, RecheckConclusion, ReviewUsage } from '@metorial/review-engine';

export let sumUsage = (a: ReviewUsage, b: ReviewUsage): ReviewUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
  costMicros: a.costMicros + b.costMicros
});

export let carryOverReport = (d: { report: SecurityReport; keepFindingKeys: Set<string> }) => {
  let { changes, resolvedFindings, findings, ...sections } = d.report;

  return {
    ...sections,
    findings: (findings ?? []).filter(finding => d.keepFindingKeys.has(finding.key))
  } satisfies SecurityReport;
};

export let restoreWebSnapshots = (d: {
  files: Record<string, Uint8Array>;
  ledger: EvidenceLedger;
}) => {
  for (let [path, content] of Object.entries(d.files)) {
    if (!path.startsWith('/web/')) continue;

    let source = Buffer.from(content)
      .toString('utf8')
      .match(/^<!-- source: (\S+) -->/)?.[1];
    let hash = path.match(/^\/web\/([0-9a-f]+)\.md$/)?.[1];
    if (source && hash) d.ledger.addUrl(source, hash);
  }
};

export type AgentRunResult = {
  draft: SecurityReport;
  complete: boolean;
  budgetExhausted: boolean;
  gaps: string[];
  model: string;
  costMicros: number;
  unchanged: RecheckConclusion | null;
};
