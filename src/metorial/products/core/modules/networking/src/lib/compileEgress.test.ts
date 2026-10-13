import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({
  getId: (model: string) => ({ oid: BigInt(1), id: `${model}_generated` })
}));

import { compileEgressRules, EgressCompileError } from './compileEgress';

let rule = (
  over: Partial<PrismaJson.NetworkPolicyRule> &
    Pick<PrismaJson.NetworkPolicyRule, 'effect' | 'cidrs'>
): PrismaJson.NetworkPolicyRule => ({
  id: Math.random().toString(36).slice(2),
  direction: 'egress',
  enabled: true,
  priority: 0,
  ...over
});

let firewall = (...rules: PrismaJson.NetworkPolicyRule[]) => ({ policies: [{ rules }] });

let denyAll = [
  { action: 'deny', protocol: 'any', cidr: '0.0.0.0/0' },
  { action: 'deny', protocol: 'any', cidr: '::/0' }
];

describe('compileEgressRules', () => {
  it('leaves egress open without firewalls', () => {
    expect(compileEgressRules({ firewalls: [] })).toEqual({ rules: [], warnings: [] });
  });

  it('denies everything for a firewall with no egress rules', () => {
    let result = compileEgressRules({ firewalls: [firewall()] });
    expect(result.rules).toEqual(denyAll);
  });

  it('ignores ingress and disabled rules', () => {
    let result = compileEgressRules({
      firewalls: [
        firewall(
          rule({ effect: 'allow', cidrs: ['93.184.216.0/24'], direction: 'ingress' }),
          rule({ effect: 'allow', cidrs: ['93.184.217.0/24'], enabled: false })
        )
      ]
    });
    expect(result.rules).toEqual(denyAll);
  });

  it('emits allows with port ranges before the default deny', () => {
    let result = compileEgressRules({
      firewalls: [
        firewall(
          rule({
            effect: 'allow',
            cidrs: ['93.184.216.0/24'],
            ports: [{ from: 443, to: 443 }]
          })
        )
      ]
    });
    expect(result.rules).toEqual([
      { action: 'allow', protocol: 'any', cidr: '93.184.216.0/24', ports: [443, 443] },
      ...denyAll
    ]);
  });

  it('lets higher priority deny carve out an allow', () => {
    let result = compileEgressRules({
      firewalls: [
        firewall(
          rule({ effect: 'allow', cidrs: ['93.184.216.0/24'] }),
          rule({ effect: 'deny', cidrs: ['93.184.216.128/25'], priority: 10 })
        )
      ]
    });
    expect(result.rules).toEqual([
      { action: 'allow', protocol: 'any', cidr: '93.184.216.0/25' },
      ...denyAll
    ]);
  });

  it('merges rules across firewalls', () => {
    let result = compileEgressRules({
      firewalls: [
        firewall(rule({ effect: 'allow', cidrs: ['93.184.216.0/24'] })),
        firewall(rule({ effect: 'allow', cidrs: ['198.41.0.0/24'] }))
      ]
    });
    expect(
      result.rules
        .filter(r => r.action === 'allow')
        .map(r => r.cidr)
        .sort()
    ).toEqual(['198.41.0.0/24', '93.184.216.0/24']);
  });

  it('collapses an allow-everything list to open egress', () => {
    let result = compileEgressRules({
      firewalls: [firewall(rule({ effect: 'allow', cidrs: ['0.0.0.0/0', '::/0'] }))]
    });
    expect(result.rules).toEqual([]);
  });

  it('drops allows inside unreachable ranges and warns', () => {
    let result = compileEgressRules({
      firewalls: [
        firewall(rule({ effect: 'allow', cidrs: ['10.0.0.0/8', '93.184.216.0/24'] }))
      ]
    });
    expect(result.rules).toEqual([
      { action: 'allow', protocol: 'any', cidr: '93.184.216.0/24' },
      ...denyAll
    ]);
    expect(result.warnings).toHaveLength(1);
  });

  it('rejects results that exceed the rule limit', () => {
    let cidrs = Array.from({ length: 150 }, (_, i) => `93.${i}.0.0/24`);
    expect(() =>
      compileEgressRules({
        firewalls: [
          firewall(
            ...cidrs.map((cidr, i) =>
              rule({ effect: 'allow', cidrs: [cidr], ports: [{ from: 1 + i, to: 1 + i }] })
            )
          )
        ]
      })
    ).toThrow(EgressCompileError);
  }, 30_000);
});
