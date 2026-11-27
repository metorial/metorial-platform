import type { SecurityReport } from '@metorial-subspace/db';
import type { EvidenceLedger, RecheckConclusion, ReviewUsage } from '@metorial/review-engine';

let JUDGE_EVIDENCE_MAX_CHARS = 80_000;
let JUDGE_FILE_MAX_CHARS = 12_000;

export let buildJudgeEvidence = (d: {
  report: SecurityReport;
  files: Record<string, string>;
}) => {
  let references: { path: string; lines?: number[] }[] = [];
  let factIds = new Set<string>();
  let visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (let item of value) visit(item);
    } else if (value && typeof value == 'object') {
      let ref = value as {
        type?: string;
        path?: string;
        lines?: number[];
        key?: string;
        id?: string;
      };
      if (ref.type == 'fact' && ref.id) factIds.add(ref.id);
      if (ref.type == 'file' && ref.path)
        references.push({ path: ref.path, lines: ref.lines });
      if (ref.type == 'tool' && ref.key)
        references.push({ path: `/evidence/tools/${ref.key.replace(/[^\w.-]+/g, '_')}.json` });
      for (let item of Object.values(value)) visit(item);
    }
  };
  visit(d.report);

  let remaining = JUDGE_EVIDENCE_MAX_CHARS;
  let excerpts: { path: string; startLine: number; content: string; truncated: boolean }[] =
    [];
  for (let ref of references) {
    if (remaining <= 0) break;
    let content = d.files[ref.path.replace(/^\/evidence\//, '')];
    if (content === undefined) continue;

    let startLine = ref.lines?.[0] ?? 1;
    let lines = content.split('\n');
    let selected = lines
      .slice(Math.max(0, startLine - 3), ref.lines ? ref.lines[1]! + 2 : undefined)
      .join('\n');
    let excerpt = selected.slice(0, Math.min(JUDGE_FILE_MAX_CHARS, remaining));
    if (excerpts.some(existing => existing.path == ref.path && existing.content == excerpt))
      continue;

    excerpts.push({
      path: ref.path,
      startLine: Math.max(1, startLine - 2),
      content: excerpt,
      truncated: excerpt.length < selected.length
    });
    remaining -= excerpt.length;
  }

  let facts: unknown[] = [];
  try {
    let source = JSON.parse(d.files['facts.json'] ?? '{}') as {
      facts?: { id: string; title: string; detail: string }[];
    };
    for (let fact of source.facts ?? []) {
      if (!factIds.has(fact.id) || remaining <= 0) continue;
      let detail = fact.detail.slice(0, Math.min(JUDGE_FILE_MAX_CHARS, remaining));
      facts.push({ ...fact, detail, truncated: detail.length < fact.detail.length });
      remaining -= detail.length;
    }
  } catch {}

  return { excerpts, facts, budgetExhausted: remaining <= 0 };
};

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
