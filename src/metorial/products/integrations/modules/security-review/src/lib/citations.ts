import type {
  SecurityLedgerRef,
  SecurityReport,
  SecurityReportFinding
} from '@metorial-subspace/db';
import type { LedgerFact } from '@metorial/review-engine';
import { scanSecrets } from './detectors';

let EXCERPT_MAX_LINES = 40;
let EXCERPT_MAX_CHARS = 4000;
let FACT_DETAIL_MAX_CHARS = 500;

let EXCERPT_PREFIXES = ['/evidence/code/', '/evidence/skill/'];

export type CitationSources = {
  facts: LedgerFact[];
  files: Record<string, string>;
};

let excerptFor = (d: { path: string; lines?: number[]; files: Record<string, string> }) => {
  if (!EXCERPT_PREFIXES.some(prefix => d.path.startsWith(prefix))) return undefined;

  let content = d.files[d.path.replace(/^\/evidence\//, '')];
  if (content === undefined) return undefined;

  if (!d.lines?.length) return undefined;

  let start = d.lines[0]!;
  let end = d.lines[1] ?? start;
  if (start < 1 || end < start) return undefined;

  let excerpt = content
    .split('\n')
    .slice(start - 1, Math.min(end, start - 1 + EXCERPT_MAX_LINES))
    .join('\n')
    .slice(0, EXCERPT_MAX_CHARS);
  if (!excerpt.trim()) return undefined;

  // A finding about a hardcoded secret must not copy the secret into the report.
  if (scanSecrets({ [d.path]: excerpt }).length) return undefined;

  return excerpt;
};

// Titles, details and excerpts are always taken from the collected evidence, never from what the
// agent wrote, so a citation cannot display text the evidence does not contain.
export let resolveCitation = (ref: SecurityLedgerRef, sources: CitationSources) => {
  if (ref.type == 'file') {
    let { excerpt: _discarded, ...rest } = ref;
    let excerpt = excerptFor({ path: ref.path, lines: ref.lines, files: sources.files });
    return excerpt ? { ...rest, excerpt } : rest;
  }

  if (ref.type == 'fact') {
    let fact = sources.facts.find(candidate => candidate.id == ref.id);
    return {
      type: 'fact' as const,
      id: ref.id,
      ...(fact
        ? { title: fact.title, detail: fact.detail.slice(0, FACT_DETAIL_MAX_CHARS) }
        : {})
    };
  }

  return ref;
};

let resolveAll = (refs: SecurityLedgerRef[], sources: CitationSources) =>
  refs.map(ref => resolveCitation(ref, sources));

export let resolveFindingCitations = <T extends Pick<SecurityReportFinding, 'evidence'>>(
  finding: T,
  sources: CitationSources
): T => ({ ...finding, evidence: resolveAll(finding.evidence, sources) });

export let resolveReportCitations = (report: SecurityReport, sources: CitationSources) => ({
  ...report,
  ...(report.provenance
    ? {
        provenance: {
          ...report.provenance,
          evidence: resolveAll(report.provenance.evidence, sources)
        }
      }
    : {}),
  ...(report.capabilities?.behaviors
    ? {
        capabilities: {
          ...report.capabilities,
          behaviors: report.capabilities.behaviors.map(behavior => ({
            ...behavior,
            evidence: resolveAll(behavior.evidence, sources)
          }))
        }
      }
    : {}),
  ...(report.implementation
    ? {
        implementation: {
          strengths: report.implementation.strengths.map(point => ({
            ...point,
            evidence: resolveAll(point.evidence, sources)
          })),
          weaknesses: report.implementation.weaknesses.map(point => ({
            ...point,
            evidence: resolveAll(point.evidence, sources)
          }))
        }
      }
    : {}),
  ...(report.findings
    ? {
        findings: report.findings.map(finding => resolveFindingCitations(finding, sources))
      }
    : {})
});
