import { describe, expect, it } from 'vitest';
import {
  assertUrlAllowedByEgressPolicy,
  egressPolicyToRuntimeNetworkRules
} from './egressPolicy';

let egressPolicy = {
  direction: 'egress' as const,
  entries: [
    { cidr: '10.0.0.0/8', portRange: { from: 443, to: 443 } },
    { cidr: '::1/128', portRange: { from: 80, to: 8080 } }
  ]
};

describe('egressPolicyToRuntimeNetworkRules', () => {
  it('converts compiled egress entries into allow rules', () => {
    expect(egressPolicyToRuntimeNetworkRules(egressPolicy)).toEqual([
      {
        action: 'allow',
        destination: '10.0.0.0/8',
        portRangeStart: 443,
        portRangeEnd: undefined
      },
      {
        action: 'allow',
        destination: '::1/128',
        portRangeStart: 80,
        portRangeEnd: 8080
      }
    ]);
  });
});

describe('assertUrlAllowedByEgressPolicy', () => {
  it('allows unrestricted remote URLs when no policy is present', async () => {
    await expect(
      assertUrlAllowedByEgressPolicy({ url: 'https://example.com' })
    ).resolves.toBeUndefined();
  });

  it('rejects remote URLs outside the policy', async () => {
    await expect(
      assertUrlAllowedByEgressPolicy({
        url: 'http://localhost:80',
        egressPolicy: {
          direction: 'egress',
          entries: [{ cidr: '192.0.2.0/24' }]
        }
      })
    ).rejects.toThrow(/egress policy/i);
  });
});
