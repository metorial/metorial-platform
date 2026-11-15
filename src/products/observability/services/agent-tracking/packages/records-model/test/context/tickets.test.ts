import { describe, expect, it } from 'vitest';
import { ticketRefsFromBranch } from '../../src/context/tickets';

describe('ticketRefsFromBranch', () => {
  it.each([
    ['feature/ENG-123-add-login', ['ENG-123']],
    ['ENG-1', ['ENG-1']],
    ['fix/PROJ2-45_and_OPS-7', ['PROJ2-45', 'OPS-7']],
    ['ENG-123/ENG-123-again', ['ENG-123']],
    ['release-2026-01', []],
    ['feature/eng-123', []],
    ['E-1', []],
    ['XENG-12a', []],
    ['main', []]
  ])('extracts from %s', (branch, refs) => {
    expect(ticketRefsFromBranch(branch)).toEqual(refs);
  });

  it('handles a missing branch', () => {
    expect(ticketRefsFromBranch(undefined)).toEqual([]);
  });

  it('caps the number of refs', () => {
    let branch = Array.from({ length: 20 }, (_, index) => `AB-${index + 1}`).join('/');

    expect(ticketRefsFromBranch(branch)).toHaveLength(8);
  });
});
