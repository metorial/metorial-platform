import type { ClassificationCandidate } from '../store/derivedModels';
import type { CandidateEntity } from './candidates';

export let ticketConfidence = 0.95;
export let workspacePriorConfidence = 0.9;
export let repoPriorConfidence = 0.85;
let priorConfidenceStep = 0.03;
let maxPriorConfidence = 0.99;

let ticketRefPattern = /^([A-Za-z][A-Za-z0-9_]*)-\d+$/;

export type PriorEvidence = { entityId: string; via: 'workspace' | 'repo' };

let round = (value: number) => Math.round(value * 1000) / 1000;

export let ticketPrefixOf = (ref: string) =>
  ref.trim().match(ticketRefPattern)?.[1]?.toUpperCase();

export let matchTicketRefs = (d: {
  ticketRefs: string[];
  candidates: CandidateEntity[];
}): ClassificationCandidate[] => {
  let prefixes = new Set(
    d.ticketRefs.map(ticketPrefixOf).filter((prefix): prefix is string => !!prefix)
  );
  if (!prefixes.size) return [];

  let matches = d.candidates
    .map(candidate => ({
      entityId: candidate.id,
      count: candidate.ticketPrefixes.filter(prefix => prefixes.has(prefix)).length
    }))
    .filter(match => match.count > 0);

  let total = matches.reduce((sum, match) => sum + match.count, 0);

  return matches.map(match => ({
    entityId: match.entityId,
    confidence: round((ticketConfidence * match.count) / total)
  }));
};

// Workspace confirmations outrank repo confirmations, because one repo can legitimately serve
// several projects while a workspace (one checkout) almost never does.
export let scorePriors = (d: {
  evidence: PriorEvidence[];
  candidateIds: Set<string>;
}): ClassificationCandidate[] => {
  let relevant = d.evidence.filter(item => d.candidateIds.has(item.entityId));
  let workspace = relevant.filter(item => item.via == 'workspace');
  let pool = workspace.length ? workspace : relevant.filter(item => item.via == 'repo');
  if (!pool.length) return [];

  let base = workspace.length ? workspacePriorConfidence : repoPriorConfidence;

  let counts = new Map<string, number>();
  for (let item of pool) counts.set(item.entityId, (counts.get(item.entityId) ?? 0) + 1);

  return [...counts].map(([entityId, count]) => ({
    entityId,
    confidence: round(
      Math.min(maxPriorConfidence, base + priorConfidenceStep * (count - 1)) *
        (count / pool.length)
    )
  }));
};
