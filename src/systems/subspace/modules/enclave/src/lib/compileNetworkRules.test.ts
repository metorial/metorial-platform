import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({
  getId: (model: string) => ({
    oid: BigInt(1),
    id: `${model}_generated`
  })
}));

import {
  compileNetworkRulesForEnclave,
  compileNetworkRulesFromFirewalls,
  dedupeFirewallsByOid
} from './compileNetworkRules';

let rule = (id: string, priority: number) => ({
  id,
  effect: 'allow' as const,
  direction: 'ingress' as const,
  cidrs: ['0.0.0.0/0'],
  enabled: true,
  priority
});

let firewall = (
  oid: bigint,
  networkOid: bigint,
  policies: {
    position: number;
    rules: ReturnType<typeof rule>[];
  }[]
) => ({
  oid,
  networkOid,
  networkPolicyLinks: policies.map(policy => ({
    position: policy.position,
    networkPolicy: {
      currentVersion: {
        rules: policy.rules
      }
    }
  }))
});

describe('dedupeFirewallsByOid', () => {
  it('keeps the first occurrence of each firewall', () => {
    expect(
      dedupeFirewallsByOid([
        { oid: BigInt(1), name: 'first' },
        { oid: BigInt(2), name: 'second' },
        { oid: BigInt(1), name: 'duplicate' }
      ])
    ).toEqual([
      { oid: BigInt(1), name: 'first' },
      { oid: BigInt(2), name: 'second' }
    ]);
  });
});

describe('compileNetworkRulesFromFirewalls', () => {
  it('returns rules in firewall and policy order without combining them', () => {
    let rules = compileNetworkRulesFromFirewalls([
      firewall(BigInt(1), BigInt(100), [
        { position: 1, rules: [rule('npr_a', 20)] },
        { position: 0, rules: [rule('npr_b', 10)] }
      ]),
      firewall(BigInt(2), BigInt(100), [{ position: 0, rules: [rule('npr_c', 30)] }])
    ]);

    expect(rules.map(r => r.id)).toEqual(['npr_b', 'npr_a', 'npr_c']);
  });
});

describe('compileNetworkRulesForEnclave', () => {
  it('only includes firewalls on the enclave network', () => {
    let rules = compileNetworkRulesForEnclave({
      enclaveNetworkOid: BigInt(100),
      firewalls: [
        firewall(BigInt(1), BigInt(100), [{ position: 0, rules: [rule('npr_a', 10)] }]),
        firewall(BigInt(2), BigInt(200), [{ position: 0, rules: [rule('npr_b', 20)] }])
      ]
    });

    expect(rules.map(r => r.id)).toEqual(['npr_a']);
  });

  it('dedupes firewalls matched through multiple bindings', () => {
    let sharedFirewall = firewall(BigInt(1), BigInt(100), [
      { position: 0, rules: [rule('npr_a', 10), rule('npr_b', 20)] }
    ]);

    let rules = compileNetworkRulesForEnclave({
      enclaveNetworkOid: BigInt(100),
      firewalls: [sharedFirewall, sharedFirewall]
    });

    expect(rules.map(r => r.id)).toEqual(['npr_a', 'npr_b']);
  });
});
