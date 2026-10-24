import { db, type SecurityReportFinding } from '@metorial-subspace/db';
import { protoGuardFilterDefinitions } from '@metorial-subspace/module-connection/src/protoguard/filters';
import type { LedgerFact } from '@metorial/review-engine';
import { addressesReviewer } from '../detectors';
import type { EvidenceTool } from '../evidence';

let DIGEST_WINDOW_DAYS = 30;
let DIGEST_MAX_ALERTS = 500;
let DIGEST_MAX_SAMPLES = 5;
let SAMPLE_MAX_LENGTH = 400;

let toolKeySlug = (key: string) =>
  key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

let toolTexts = (tool: EvidenceTool) => [
  { path: `tool:${tool.key}:description`, content: tool.description ?? '' },
  { path: `tool:${tool.key}:schema`, content: JSON.stringify(tool.inputSchema ?? {}) }
];

// ProtoGuard filters are written for session messages; on static tool definitions only the
// scan targets matter, so the message is never read.
let runFilters = (targets: { path: string; content: string }[]) =>
  protoGuardFilterDefinitions.flatMap(definition =>
    definition
      .check({ message: undefined as never, targets })
      .matches.filter(match => match.confidence >= definition.alertConfidenceThreshold)
      .map(match => ({ definition, match }))
  );

export let scanToolDefinitions = (tools: EvidenceTool[]) => {
  let facts: LedgerFact[] = [];
  let findings: SecurityReportFinding[] = [];

  for (let tool of tools) {
    let targets = toolTexts(tool).filter(target => target.content.length);
    let hits = runFilters(targets);
    let aimedAtReviewer = targets.some(target => addressesReviewer(target.content));

    if (!hits.length && !aimedAtReviewer) continue;

    let factId = `protoguard-${toolKeySlug(tool.key)}`;
    let detail = [
      ...hits.map(hit => `${hit.definition.name}: "${hit.match.matchedText.slice(0, 120)}"`),
      ...(aimedAtReviewer
        ? ['Text addresses an AI reviewer or tries to influence the rating.']
        : [])
    ].join('\n');

    facts.push({ id: factId, title: `Suspicious text in ${tool.key}`, detail });

    let critical = aimedAtReviewer || hits.some(hit => hit.definition.severity == 'critical');

    findings.push({
      key: `tool-poisoning-${toolKeySlug(tool.key)}`,
      kind: 'security',
      category: 'tool_poisoning',
      severity: critical ? 'critical' : 'high',
      title: `${tool.key} contains instructions aimed at the model`,
      body: `The definition of ${tool.key} contains text that tries to steer the AI agent using it (${
        [...new Set(hits.map(hit => hit.definition.name.toLowerCase()))].join(', ') ||
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
  let hits = runFilters([{ path: d.label, content: d.content }]);
  return { hits: hits.length, aimedAtReviewer: addressesReviewer(d.content) };
};

let redact = (value: string) =>
  value
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[token]')
    .slice(0, SAMPLE_MAX_LENGTH);

export let buildProtoGuardDigest = async (d: {
  tenantOid: bigint;
  providerVersionOid: bigint;
}) => {
  let since = new Date(Date.now() - DIGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let instances = await db.protoGuardAlertInstance.findMany({
    where: {
      createdAt: { gte: since },
      alert: {
        tenantOid: d.tenantOid,
        providerRun: { providerVersionOid: d.providerVersionOid }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: DIGEST_MAX_ALERTS,
    select: {
      issueType: true,
      severity: true,
      path: true,
      matchedText: true,
      alertOid: true,
      filter: { select: { key: true } }
    }
  });

  if (!instances.length) return null;

  let byFilter = new Map<string, { filter: string; severity: string; count: number }>();
  for (let instance of instances) {
    let key = instance.filter.key;
    let entry = byFilter.get(key) ?? { filter: key, severity: instance.severity, count: 0 };
    entry.count++;
    byFilter.set(key, entry);
  }

  return {
    windowDays: DIGEST_WINDOW_DAYS,
    alerts: new Set(instances.map(instance => instance.alertOid)).size,
    matches: instances.length,
    filters: [...byFilter.values()].sort((a, b) => b.count - a.count),
    samples: instances.slice(0, DIGEST_MAX_SAMPLES).map(instance => ({
      issueType: instance.issueType,
      severity: instance.severity,
      path: instance.path,
      excerpt: redact(instance.matchedText)
    }))
  };
};
