import { describe, expect, it } from 'vitest';
import {
  classificationStatus,
  clefCandidates,
  decideResult,
  isBetterResult,
  rankCandidates
} from '../results';

describe('decideResult', () => {
  it('accepts the top candidate at or above the threshold', () => {
    let result = decideResult({
      kind: 'project',
      stage: 'clef',
      threshold: 0.8,
      candidates: [
        { entityId: 'gen_b', confidence: 0.1 },
        { entityId: 'gen_a', confidence: 0.8 }
      ]
    });

    expect(result.accepted).toEqual({ entityId: 'gen_a', confidence: 0.8 });
    expect(result.candidates.map(candidate => candidate.entityId)).toEqual(['gen_a', 'gen_b']);
  });

  it('leaves results below the threshold for review with their suggestions', () => {
    let result = decideResult({
      kind: 'project',
      stage: 'prior',
      threshold: 0.8,
      candidates: [{ entityId: 'gen_a', confidence: 0.79 }]
    });

    expect(result.accepted).toBeUndefined();
    expect(result.candidates).toEqual([{ entityId: 'gen_a', confidence: 0.79 }]);
  });

  it('honours a custom threshold and drops rejected entities', () => {
    let result = decideResult({
      kind: 'project',
      stage: 'clef',
      threshold: 0.5,
      rejectedEntityIds: ['gen_a'],
      candidates: [
        { entityId: 'gen_a', confidence: 0.9 },
        { entityId: 'gen_b', confidence: 0.6 }
      ]
    });

    expect(result.accepted?.entityId).toBe('gen_b');
    expect(result.rejectedEntityIds).toEqual(['gen_a']);
  });
});

describe('rankCandidates', () => {
  it('dedupes by entity, keeps the best confidence and limits suggestions', () => {
    let ranked = rankCandidates([
      { entityId: 'gen_a', confidence: 0.2 },
      { entityId: 'gen_a', confidence: 0.4 },
      ...['b', 'c', 'd', 'e', 'f'].map(id => ({ entityId: `gen_${id}`, confidence: 0.1 }))
    ]);

    expect(ranked).toHaveLength(5);
    expect(ranked[0]).toEqual({ entityId: 'gen_a', confidence: 0.4 });
    expect(ranked.slice(1).map(candidate => candidate.entityId)).toEqual([
      'gen_b',
      'gen_c',
      'gen_d',
      'gen_e'
    ]);
  });
});

describe('isBetterResult', () => {
  let result = (confidence: number, accepted = false) => ({
    kind: 'project',
    stage: 'clef' as const,
    candidates: [{ entityId: 'gen_a', confidence }],
    accepted: accepted ? { entityId: 'gen_a', confidence } : undefined
  });

  it('prefers accepted and then more confident results', () => {
    expect(isBetterResult(result(0.5), undefined)).toBe(true);
    expect(isBetterResult(result(0.9, true), result(0.5))).toBe(true);
    expect(isBetterResult(result(0.6), result(0.5))).toBe(true);
    expect(isBetterResult(result(0.4), result(0.5))).toBe(false);
    expect(isBetterResult(result(0.99, true), result(0.85, true))).toBe(false);
  });
});

describe('clefCandidates', () => {
  it('keeps only shortlisted entity options, never none', () => {
    expect(
      clefCandidates(
        {
          choice: 'gen_a',
          confidence: 0.9,
          probabilities: { gen_a: 0.88, gen_b: 0.05, gen_other: 0.04, none: 0.03 }
        },
        new Set(['gen_a', 'gen_b'])
      )
    ).toEqual([
      { entityId: 'gen_a', confidence: 0.88 },
      { entityId: 'gen_b', confidence: 0.05 },
      { entityId: 'gen_a', confidence: 0.9 }
    ]);

    expect(
      clefCandidates(
        { choice: 'none', confidence: 0.9, probabilities: { none: 0.9, gen_a: 0.1 } },
        new Set(['gen_a'])
      )
    ).toEqual([{ entityId: 'gen_a', confidence: 0.1 }]);
  });
});

describe('classificationStatus', () => {
  let accepted = {
    kind: 'project',
    stage: 'ticket' as const,
    candidates: [],
    accepted: { entityId: 'gen_a', confidence: 0.95 }
  };
  let open = {
    kind: 'cost_center',
    stage: 'clef' as const,
    candidates: [{ entityId: 'gen_c', confidence: 0.4 }]
  };
  let empty = { kind: 'custom:department', stage: 'prior' as const, candidates: [] };
  let rejected = {
    kind: 'cost_center',
    stage: 'clef' as const,
    candidates: [],
    review: { action: 'reject' as const, entityId: 'gen_b', at: new Date() }
  };

  it('summarises the per-kind results', () => {
    expect(classificationStatus([])).toBe('skipped');
    expect(classificationStatus([accepted])).toBe('accepted');
    expect(classificationStatus([accepted, open])).toBe('needs_review');
    expect(classificationStatus([accepted, rejected])).toBe('rejected');
    expect(classificationStatus([rejected, open])).toBe('needs_review');
  });

  it('ignores kinds without any candidate', () => {
    expect(classificationStatus([empty])).toBe('skipped');
    expect(classificationStatus([empty, empty])).toBe('skipped');
    expect(classificationStatus([accepted, empty])).toBe('accepted');
    expect(classificationStatus([open, empty])).toBe('needs_review');
    expect(classificationStatus([rejected, empty])).toBe('rejected');
  });
});
