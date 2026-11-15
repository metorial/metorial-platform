import { describe, expect, it } from 'vitest';
import {
  classificationStatus,
  clefCandidates,
  decideResult,
  isBetterResult,
  rankCandidates
} from '../src/lib/results';

describe('decideResult', () => {
  it('accepts the top candidate at or above the threshold', () => {
    let result = decideResult({
      kind: 'project',
      stage: 'clef',
      threshold: 0.8,
      candidates: [
        { entityId: 'aten_b', confidence: 0.1 },
        { entityId: 'aten_a', confidence: 0.8 }
      ]
    });

    expect(result.accepted).toEqual({ entityId: 'aten_a', confidence: 0.8 });
    expect(result.candidates.map(candidate => candidate.entityId)).toEqual([
      'aten_a',
      'aten_b'
    ]);
  });

  it('leaves results below the threshold for review with their suggestions', () => {
    let result = decideResult({
      kind: 'project',
      stage: 'prior',
      threshold: 0.8,
      candidates: [{ entityId: 'aten_a', confidence: 0.79 }]
    });

    expect(result.accepted).toBeUndefined();
    expect(result.candidates).toEqual([{ entityId: 'aten_a', confidence: 0.79 }]);
  });

  it('honours a custom threshold and drops rejected entities', () => {
    let result = decideResult({
      kind: 'project',
      stage: 'clef',
      threshold: 0.5,
      rejectedEntityIds: ['aten_a'],
      candidates: [
        { entityId: 'aten_a', confidence: 0.9 },
        { entityId: 'aten_b', confidence: 0.6 }
      ]
    });

    expect(result.accepted?.entityId).toBe('aten_b');
    expect(result.rejectedEntityIds).toEqual(['aten_a']);
  });
});

describe('rankCandidates', () => {
  it('dedupes by entity, keeps the best confidence and limits suggestions', () => {
    let ranked = rankCandidates([
      { entityId: 'aten_a', confidence: 0.2 },
      { entityId: 'aten_a', confidence: 0.4 },
      ...['b', 'c', 'd', 'e', 'f'].map(id => ({ entityId: `aten_${id}`, confidence: 0.1 }))
    ]);

    expect(ranked).toHaveLength(5);
    expect(ranked[0]).toEqual({ entityId: 'aten_a', confidence: 0.4 });
    expect(ranked.slice(1).map(candidate => candidate.entityId)).toEqual([
      'aten_b',
      'aten_c',
      'aten_d',
      'aten_e'
    ]);
  });
});

describe('isBetterResult', () => {
  let result = (confidence: number, accepted = false) => ({
    kind: 'project',
    stage: 'clef' as const,
    candidates: [{ entityId: 'aten_a', confidence }],
    accepted: accepted ? { entityId: 'aten_a', confidence } : undefined
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
          choice: 'aten_a',
          confidence: 0.9,
          probabilities: { aten_a: 0.88, aten_b: 0.05, aten_other: 0.04, none: 0.03 }
        },
        new Set(['aten_a', 'aten_b'])
      )
    ).toEqual([
      { entityId: 'aten_a', confidence: 0.88 },
      { entityId: 'aten_b', confidence: 0.05 },
      { entityId: 'aten_a', confidence: 0.9 }
    ]);

    expect(
      clefCandidates(
        { choice: 'none', confidence: 0.9, probabilities: { none: 0.9, aten_a: 0.1 } },
        new Set(['aten_a'])
      )
    ).toEqual([{ entityId: 'aten_a', confidence: 0.1 }]);
  });
});

describe('classificationStatus', () => {
  let accepted = {
    kind: 'project',
    stage: 'ticket' as const,
    candidates: [],
    accepted: { entityId: 'aten_a', confidence: 0.95 }
  };
  let open = {
    kind: 'cost_center',
    stage: 'clef' as const,
    candidates: [{ entityId: 'aten_c', confidence: 0.4 }]
  };
  let empty = { kind: 'custom:department', stage: 'prior' as const, candidates: [] };
  let rejected = {
    kind: 'cost_center',
    stage: 'clef' as const,
    candidates: [],
    review: { action: 'reject' as const, entityId: 'aten_b', at: new Date() }
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
