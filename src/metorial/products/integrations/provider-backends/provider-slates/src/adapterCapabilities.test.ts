import { describe, expect, it } from 'vitest';
import { canonicalizeAdapterCapabilities } from './adapterCapabilities';

describe('canonicalizeAdapterCapabilities', () => {
  it('deduplicates by identifier and sorts the version snapshot', () => {
    expect(
      canonicalizeAdapterCapabilities([
        { id: 'messages.write', value: false },
        { id: 'channels.read', value: true },
        { id: 'messages.write', value: { mode: 'threaded' } }
      ])
    ).toEqual([
      { id: 'channels.read', value: true },
      { id: 'messages.write', value: { mode: 'threaded' } }
    ]);
  });
});
