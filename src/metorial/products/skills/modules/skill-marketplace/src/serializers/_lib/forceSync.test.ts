import { canonicalize } from '@lowerdeck/canonicalize';
import { describe, expect, it } from 'vitest';
import { getMarketplaceForceSyncHashInput } from './forceSync';

describe('marketplace force sync hash input', () => {
  it('does not change existing hashes before a marketplace is force synced', () => {
    expect(getMarketplaceForceSyncHashInput()).toEqual({});
    expect(getMarketplaceForceSyncHashInput({ forceSyncCounter: 0 })).toEqual({});
  });

  it('changes the canonical hash input every time the counter is incremented', () => {
    let first = canonicalize({
      content: 'unchanged',
      ...getMarketplaceForceSyncHashInput({ forceSyncCounter: 1 })
    });
    let second = canonicalize({
      content: 'unchanged',
      ...getMarketplaceForceSyncHashInput({ forceSyncCounter: 2 })
    });

    expect(first).not.toBe(second);
  });
});
