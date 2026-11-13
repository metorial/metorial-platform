import { describe, expect, it } from 'vitest';
import {
  matchTicketRefs,
  repoPriorConfidence,
  scorePriors,
  ticketConfidence,
  ticketPrefixOf,
  workspacePriorConfidence
} from '../src/lib/stages';
import { candidate } from './fixtures';

describe('ticketPrefixOf', () => {
  it('extracts the project key of a ticket ref', () => {
    expect(ticketPrefixOf('ENG-123')).toBe('ENG');
    expect(ticketPrefixOf(' eng-7 ')).toBe('ENG');
    expect(ticketPrefixOf('A1_B-9')).toBe('A1_B');
    expect(ticketPrefixOf('#123')).toBeUndefined();
    expect(ticketPrefixOf('ENG-')).toBeUndefined();
    expect(ticketPrefixOf('123-ENG')).toBeUndefined();
  });
});

describe('matchTicketRefs', () => {
  let candidates = [
    candidate({ id: 'aten_billing', ticketPrefixes: ['BILL'] }),
    candidate({ id: 'aten_platform', ticketPrefixes: ['ENG', 'OPS'] }),
    candidate({ id: 'aten_mobile', ticketPrefixes: ['MOB'] })
  ];

  it('matches a unique prefix with high confidence', () => {
    expect(matchTicketRefs({ ticketRefs: ['eng-12', 'ENG-13'], candidates })).toEqual([
      { entityId: 'aten_platform', confidence: ticketConfidence }
    ]);
  });

  it('splits the confidence when several entities match', () => {
    let matches = matchTicketRefs({ ticketRefs: ['BILL-1', 'MOB-2'], candidates });

    expect(matches).toEqual([
      { entityId: 'aten_billing', confidence: 0.475 },
      { entityId: 'aten_mobile', confidence: 0.475 }
    ]);
  });

  it('splits the confidence when two entities share a prefix', () => {
    let shared = [...candidates, candidate({ id: 'aten_infra', ticketPrefixes: ['ENG'] })];

    expect(matchTicketRefs({ ticketRefs: ['ENG-1'], candidates: shared })).toHaveLength(2);
    expect(
      matchTicketRefs({ ticketRefs: ['ENG-1'], candidates: shared }).every(
        match => match.confidence < 0.8
      )
    ).toBe(true);
  });

  it('returns nothing without parsable or matching refs', () => {
    expect(matchTicketRefs({ ticketRefs: [], candidates })).toEqual([]);
    expect(matchTicketRefs({ ticketRefs: ['#42', 'XYZ-1'], candidates })).toEqual([]);
  });
});

describe('scorePriors', () => {
  let candidateIds = new Set(['aten_a', 'aten_b']);

  it('prefers workspace confirmations over repo confirmations', () => {
    expect(
      scorePriors({
        evidence: [
          { entityId: 'aten_a', via: 'workspace' },
          { entityId: 'aten_b', via: 'repo' },
          { entityId: 'aten_b', via: 'repo' }
        ],
        candidateIds
      })
    ).toEqual([{ entityId: 'aten_a', confidence: workspacePriorConfidence }]);
  });

  it('uses repo confirmations when there are no workspace ones', () => {
    expect(
      scorePriors({ evidence: [{ entityId: 'aten_b', via: 'repo' }], candidateIds })
    ).toEqual([{ entityId: 'aten_b', confidence: repoPriorConfidence }]);
  });

  it('grows with repeated confirmations and shrinks with disagreement', () => {
    let repeated = scorePriors({
      evidence: Array.from({ length: 3 }, () => ({
        entityId: 'aten_a',
        via: 'workspace' as const
      })),
      candidateIds
    });
    expect(repeated[0]!.confidence).toBeCloseTo(0.96);

    let split = scorePriors({
      evidence: [
        { entityId: 'aten_a', via: 'workspace' },
        { entityId: 'aten_b', via: 'workspace' }
      ],
      candidateIds
    });
    expect(split.map(item => item.confidence)).toEqual([0.45, 0.45]);
  });

  it('ignores evidence for entities that are no longer candidates', () => {
    expect(
      scorePriors({ evidence: [{ entityId: 'aten_gone', via: 'workspace' }], candidateIds })
    ).toEqual([]);
  });
});
