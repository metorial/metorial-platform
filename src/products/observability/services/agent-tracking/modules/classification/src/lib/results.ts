import type {
  ClassificationCandidate,
  ClassificationResult,
  ClassificationStage,
  SessionClassification
} from '@mtsrc/agent-tracking-store';
import { noneOption, type ClefAnswer } from './clef';

let maxSuggestions = 5;

export let rankCandidates = (candidates: ClassificationCandidate[]) => {
  let best = new Map<string, number>();
  for (let candidate of candidates) {
    best.set(
      candidate.entityId,
      Math.max(best.get(candidate.entityId) ?? 0, candidate.confidence)
    );
  }

  return [...best]
    .map(([entityId, confidence]) => ({ entityId, confidence }))
    .sort((a, b) => b.confidence - a.confidence || a.entityId.localeCompare(b.entityId))
    .slice(0, maxSuggestions);
};

export let decideResult = (d: {
  kind: string;
  stage: ClassificationStage;
  candidates: ClassificationCandidate[];
  threshold: number;
  rejectedEntityIds?: string[];
}): ClassificationResult => {
  let rejected = d.rejectedEntityIds ?? [];
  let candidates = rankCandidates(
    d.candidates.filter(candidate => !rejected.includes(candidate.entityId))
  );
  let top = candidates[0];

  return {
    kind: d.kind,
    stage: d.stage,
    candidates,
    accepted: top && top.confidence >= d.threshold ? top : undefined,
    rejectedEntityIds: rejected.length ? rejected : undefined
  };
};

export let isBetterResult = (
  next: ClassificationResult,
  current: ClassificationResult | undefined
) => {
  if (!current) return true;
  if (current.accepted) return false;
  if (next.accepted) return true;

  return (next.candidates[0]?.confidence ?? 0) > (current.candidates[0]?.confidence ?? 0);
};

export let clefCandidates = (
  answer: ClefAnswer,
  candidateIds: Set<string>
): ClassificationCandidate[] => {
  let candidates = Object.entries(answer.probabilities)
    .filter(([option]) => option != noneOption && candidateIds.has(option))
    .map(([entityId, confidence]) => ({ entityId, confidence }));

  if (answer.choice != noneOption && candidateIds.has(answer.choice)) {
    candidates.push({ entityId: answer.choice, confidence: answer.confidence });
  }

  return candidates;
};

export let hasOutcome = (result: ClassificationResult) =>
  !!result.accepted || !!result.review || result.candidates.length > 0;

// Kinds no stage found a candidate for are recorded but don't count: there is nothing to review.
export let classificationStatus = (
  allResults: ClassificationResult[]
): SessionClassification['status'] => {
  let results = allResults.filter(hasOutcome);

  if (!results.length) return 'skipped';
  if (results.some(result => !result.accepted && result.review?.action != 'reject')) {
    return 'needs_review';
  }
  if (results.some(result => !result.accepted)) return 'rejected';

  return 'accepted';
};
