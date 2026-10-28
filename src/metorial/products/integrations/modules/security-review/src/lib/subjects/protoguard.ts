import type { SecurityReportFinding } from '@metorial-subspace/db';
import {
  scanTextForReview,
  scanToolDefinitionForReview
} from '@metorial-subspace/module-protoguard';
import type { LedgerFact } from '@metorial/review-engine';
import { addressesReviewer } from '../detectors';
import type { EvidenceTool } from '../evidence';

let toolKeySlug = (key: string) =>
  key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export let scanToolDefinitions = (tools: EvidenceTool[]) => {
  let facts: LedgerFact[] = [];
  let findings: SecurityReportFinding[] = [];

  for (let tool of tools) {
    let hits = scanToolDefinitionForReview({
      name: tool.name ?? tool.key,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations
    });
    let aimedAtReviewer = [
      tool.description ?? '',
      JSON.stringify(tool.inputSchema ?? {})
    ].some(text => addressesReviewer(text));

    if (!hits.length && !aimedAtReviewer) continue;

    let factId = `protoguard-${toolKeySlug(tool.key)}`;
    let detail = [
      ...hits.map(hit => `${hit.familyName}: "${hit.matchedText}"`),
      ...(aimedAtReviewer
        ? ['Text addresses an AI reviewer or tries to influence the rating.']
        : [])
    ].join('\n');

    facts.push({ id: factId, title: `Suspicious text in ${tool.key}`, detail });

    let critical = aimedAtReviewer || hits.some(hit => hit.severity == 'critical');

    findings.push({
      key: `tool-poisoning-${toolKeySlug(tool.key)}`,
      kind: 'security',
      category: 'tool_poisoning',
      severity: critical ? 'critical' : 'high',
      title: `${tool.key} contains instructions aimed at the model`,
      body: `The definition of ${tool.key} contains text that tries to steer the AI agent using it (${
        [...new Set(hits.map(hit => hit.familyName.toLowerCase()))].join(', ') ||
        'reviewer manipulation'
      }). Agents read tool definitions as trusted context.`,
      recommendation: 'Remove instructions from tool descriptions and schemas.',
      tools: [tool.key],
      evidence: [
        { type: 'tool', key: tool.key },
        { type: 'fact', id: factId }
      ]
    });
  }

  return { facts, findings };
};

export let scanText = (d: { label: string; content: string }) => {
  let hits = scanTextForReview(d.content);
  return { hits: hits.length, aimedAtReviewer: addressesReviewer(d.content) };
};
