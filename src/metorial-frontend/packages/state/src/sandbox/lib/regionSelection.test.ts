import { describe, expect, it } from 'vitest';
import { resolveSandboxRegion } from './regionSelection';

let regions = [
  { id: 'iad1', isDefault: false, availability: 'available' },
  { id: 'dub1', isDefault: true, availability: 'available' },
  { id: 'dev', isDefault: false, availability: 'unavailable' }
];

describe('sandbox region selection', () => {
  it('prefers the last used available region over the deployment default', () => {
    expect(resolveSandboxRegion(regions, 'iad1')).toBe('iad1');
  });

  it('falls back to the default when the remembered region is missing or unavailable', () => {
    expect(resolveSandboxRegion(regions, 'missing')).toBe('dub1');
    expect(resolveSandboxRegion(regions, 'dev')).toBe('dub1');
  });

  it('uses the first available region when the default is not offered by an image', () => {
    expect(resolveSandboxRegion([regions[0], regions[2]], 'dub1')).toBe('iad1');
    expect(resolveSandboxRegion([regions[2]], '')).toBe('');
  });
});
