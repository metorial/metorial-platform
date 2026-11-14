import type {
  SecurityCapabilityTag,
  SecurityProvenanceClass,
  SecurityReportBehavior,
  SecurityReportFinding,
  SecurityReportTool,
  SecurityReviewObservation,
  SecuritySpecCensus,
  SecurityToolHints
} from '@metorial-subspace/db';
import type { LedgerFact } from '@metorial/review-engine';

export type SubjectKind = 'slate' | 'function' | 'remote' | 'container' | 'skill';

export type EvidenceTool = {
  key: string;
  name?: string;
  description?: string | null;
  inputSchema?: unknown;
  annotations?: unknown;
  hints: SecurityToolHints;
};

export type CollectedEvidence = {
  kind: SubjectKind;
  title: string;
  description: string;
  files: Record<string, string>;
  codeFiles: Record<string, string>;
  tools: EvidenceTool[] | null;
  facts: LedgerFact[];
  findings: SecurityReportFinding[];
  observations?: SecurityReviewObservation[];
  allowedProvenance: SecurityProvenanceClass[];
  fallbackProvenance: SecurityProvenanceClass;
  behaviors?: SecurityReportBehavior[];
  skillVersionId?: string;
  contentHash?: string;
  skill?: { fileCount: number; analyzedFileCount: number; kinds: Record<string, number> };
  codeReadable?: boolean;
  contentComplete?: boolean;
  census?: SecuritySpecCensus;
  specificationOid?: bigint;
  limitations: string[];
  outOfScope?: string[];
};

export let readHints = (annotations: any): SecurityToolHints => ({
  readOnly:
    typeof annotations?.readOnlyHint == 'boolean' ? annotations.readOnlyHint : undefined,
  destructive:
    typeof annotations?.destructiveHint == 'boolean' ? annotations.destructiveHint : undefined,
  idempotent:
    typeof annotations?.idempotentHint == 'boolean' ? annotations.idempotentHint : undefined,
  openWorld:
    typeof annotations?.openWorldHint == 'boolean' ? annotations.openWorldHint : undefined
});

let readOnlyTags = new Set<SecurityCapabilityTag>([
  'read',
  'untrusted_input',
  'bulk_private_data'
]);

export let isMutatingTag = (tag: SecurityCapabilityTag) => !readOnlyTags.has(tag);

let hasAnyHint = (hints: SecurityToolHints) =>
  Object.values(hints).some(value => value !== undefined);

export let tagsFromHints = (hints: SecurityToolHints): SecurityCapabilityTag[] => {
  if (hints.readOnly) return hints.openWorld ? ['read', 'untrusted_input'] : ['read'];

  let tags: SecurityCapabilityTag[] = hints.readOnly === false ? ['write'] : [];
  if (hints.destructive === true) tags.push('destructive');
  if (hints.openWorld) tags.push('untrusted_input');
  return tags;
};

export let declaredCapabilities = (tools: EvidenceTool[]): SecurityReportTool[] =>
  tools.map(tool => ({
    key: tool.key,
    name: tool.name,
    tags: tagsFromHints(tool.hints),
    behavior:
      (tool.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) || 'No description.',
    declaredHints: tool.hints,
    hintAccuracy: hasAnyHint(tool.hints) ? 'matches' : 'undeclared',
    unclassified: true
  }));

export let hintMismatchFindings = (d: {
  tools: EvidenceTool[];
  capabilities: SecurityReportTool[];
}): SecurityReportFinding[] => {
  let byKey = new Map(d.tools.map(tool => [tool.key, tool]));

  return d.capabilities.flatMap(capability => {
    let tool = byKey.get(capability.key);
    if (!tool?.hints.readOnly) return [];

    let mutating = capability.tags.filter(isMutatingTag);
    if (!mutating.length) return [];

    let hidesDestructive = mutating.includes('destructive');

    return [
      {
        key: `annotation-mismatch-${capability.key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          .slice(0, 64)
          .replace(/-+$/, ''),
        kind: 'security',
        category: 'annotation_mismatch',
        severity: hidesDestructive ? 'high' : 'medium',
        title: `${capability.key} is declared read-only but is not`,
        body: `The tool declares readOnlyHint, but its behavior includes ${mutating.join(', ')}. Clients that auto-approve read-only tools would run it without asking.`,
        recommendation: 'Correct the tool annotations so clients can ask for confirmation.',
        tools: [capability.key],
        evidence: [{ type: 'tool', key: capability.key }]
      }
    ];
  });
};

export let wrapUntrusted = (label: string, content: string) =>
  `<untrusted-data source="${label}">\n${content}\n</untrusted-data>`;
