import { createHash } from 'node:crypto';
import { scanPayloadSync } from './scan';
import { scoreFindings, type ScoreResult } from './score';
import type { EngineFinding, Ruleset } from './types';

let RUG_PULL_RULE_KEY = 'tool_rug_pull.became_suspicious';
let RUG_PULL_PRECISION = 0.95;
let TOOL_SCAN_FLAG_PROBABILITY = 0.8;

export interface ToolDefinitionInput {
  name: string;
  title?: string | null;
  description?: string | null;
  inputSchema?: unknown;
  outputSchema?: unknown;
  annotations?: unknown;
}

export interface ToolDefinitionPrevious {
  hash: string;
  isFlagged: boolean;
}

export interface ToolDefinitionScan {
  hash: string;
  findings: EngineFinding[];
  score: ScoreResult;
  isFlagged: boolean;
  isRugPull: boolean;
}

let stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  if (value && typeof value == 'object') {
    let entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }

  return JSON.stringify(value ?? null);
};

export let hashToolDefinition = (tool: ToolDefinitionInput) =>
  createHash('sha256')
    .update(
      stableStringify({
        name: tool.name,
        title: tool.title ?? null,
        description: tool.description ?? null,
        inputSchema: tool.inputSchema ?? null,
        outputSchema: tool.outputSchema ?? null,
        annotations: tool.annotations ?? null
      })
    )
    .digest('hex');

// A rug pull is a definition that was clean when first seen and turned suspicious later, which is
// exactly what an approve-once client cannot notice on its own.
export let scanToolDefinition = (d: {
  ruleset: Ruleset;
  tool: ToolDefinitionInput;
  previous?: ToolDefinitionPrevious | null;
}): ToolDefinitionScan => {
  let hash = hashToolDefinition(d.tool);

  let result = scanPayloadSync({
    ruleset: d.ruleset,
    payload: {
      toolDefinition: {
        name: d.tool.name,
        title: d.tool.title ?? undefined,
        description: d.tool.description ?? undefined,
        inputSchema: d.tool.inputSchema ?? undefined,
        outputSchema: d.tool.outputSchema ?? undefined,
        annotations: d.tool.annotations ?? undefined
      }
    }
  });

  let families = d.ruleset.families.map(family => ({
    key: family.key,
    scoreWeight: family.scoreWeight,
    alertConfidenceThreshold: family.alertConfidenceThreshold
  }));
  let contentScore = scoreFindings({
    findings: result.findings.map(finding => ({ ...finding, isSuppressed: false })),
    families,
    alertProbabilityThreshold: TOOL_SCAN_FLAG_PROBABILITY
  });

  let isRugPull =
    !!d.previous && d.previous.hash != hash && !d.previous.isFlagged && contentScore.isAlert;

  let findings = isRugPull
    ? [
        ...result.findings,
        {
          ruleKey: RUG_PULL_RULE_KEY,
          family: 'tool_rug_pull',
          direction: 'tool_definition' as const,
          view: 'raw' as const,
          stage: 'active' as const,
          precision: RUG_PULL_PRECISION,
          hardRule: true,
          redactMatch: false,
          description: 'Tool definition changed from clean to suspicious.',
          ruleDescription: 'Tool definition changed from clean to suspicious.',
          path: [{ type: 'key' as const, key: 'tool_definition' }],
          startOffset: 0,
          endOffset: 0,
          matchedText: '',
          canonicalText: '',
          contextBefore: '',
          contextAfter: '',
          decodedSample: null
        }
      ]
    : result.findings;

  let score = isRugPull
    ? scoreFindings({
        findings: findings.map(finding => ({ ...finding, isSuppressed: false })),
        families,
        alertProbabilityThreshold: TOOL_SCAN_FLAG_PROBABILITY
      })
    : contentScore;

  return { hash, findings, score, isFlagged: score.isAlert, isRugPull };
};
