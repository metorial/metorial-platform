import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({
  db: {
    sessionProvider: { findMany: vi.fn() },
    providerVersionAdapter: { findMany: vi.fn() }
  }
}));

import { mergeAdvertisedCapabilities, normalizeAdvertisedCapabilities } from './capabilities';

describe('normalizeAdvertisedCapabilities', () => {
  it('keeps valid capability entries', () => {
    expect(
      normalizeAdvertisedCapabilities([
        { id: 'send', value: true },
        { id: 'markdown', value: false },
        { not: 'a capability' },
        null
      ])
    ).toEqual([
      { id: 'send', value: true },
      { id: 'markdown', value: false }
    ]);
  });

  it('returns an empty list for non-arrays', () => {
    expect(normalizeAdvertisedCapabilities({ id: 'send' })).toEqual([]);
  });
});

describe('mergeAdvertisedCapabilities', () => {
  it('prefers enabled values when the same capability appears more than once', () => {
    expect(
      mergeAdvertisedCapabilities([
        [
          { id: 'send', value: false },
          { id: 'markdown', value: false }
        ],
        [
          { id: 'send', value: true },
          { id: 'inbound', value: true }
        ]
      ])
    ).toEqual([
      { id: 'send', value: true },
      { id: 'markdown', value: false },
      { id: 'inbound', value: true }
    ]);
  });
});
