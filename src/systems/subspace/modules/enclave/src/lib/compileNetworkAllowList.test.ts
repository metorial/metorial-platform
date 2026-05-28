import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({
  getId: (model: string) => ({
    oid: BigInt(1),
    id: `${model}_generated`
  })
}));

import { compileNetworkAllowList } from './compileNetworkAllowList';

let rule = (
  overrides: Partial<PrismaJson.NetworkPolicyRule> & Pick<PrismaJson.NetworkPolicyRule, 'effect'>
): PrismaJson.NetworkPolicyRule => ({
  id: overrides.id ?? 'npr_test',
  effect: overrides.effect,
  direction: overrides.direction ?? 'ingress',
  cidrs: overrides.cidrs ?? ['10.0.0.0/8'],
  enabled: overrides.enabled ?? true,
  priority: overrides.priority ?? 10,
  description: overrides.description,
  ports: overrides.ports
});

describe('compileNetworkAllowList', () => {
  it('applies higher priority deny over lower priority allow', () => {
    let result = compileNetworkAllowList({
      direction: 'ingress',
      rules: [
        rule({ id: 'npr_allow', effect: 'allow', priority: 10, cidrs: ['10.0.0.0/8'] }),
        rule({ id: 'npr_deny', effect: 'deny', priority: 20, cidrs: ['10.0.0.0/24'] })
      ]
    });

    expect(result.entries).toContainEqual({ cidr: '10.0.1.0/24' });
    expect(result.entries.map(entry => entry.cidr)).not.toContain('10.0.0.0/24');
  });

  it('returns universe sentinel when everything is allowed', () => {
    let result = compileNetworkAllowList({
      direction: 'ingress',
      rules: [rule({ effect: 'allow', priority: 10, cidrs: ['0.0.0.0/0'] })]
    });

    expect(result.entries).toEqual([{ cidr: '0.0.0.0/0' }]);
  });

  it('returns empty sentinel when no enabled rules match', () => {
    let result = compileNetworkAllowList({
      direction: 'ingress',
      rules: [rule({ effect: 'allow', priority: 10, direction: 'egress' })]
    });

    expect(result.entries).toEqual([{ cidr: '0.0.0.0/32' }, { cidr: '::/128' }]);
  });

  it('returns empty sentinels for both address families on egress when no rules match', () => {
    let result = compileNetworkAllowList({
      direction: 'egress',
      rules: [rule({ effect: 'allow', priority: 10, direction: 'ingress' })]
    });

    expect(result.entries).toEqual([{ cidr: '0.0.0.0/32' }, { cidr: '::/128' }]);
  });

  it('filters by direction and skips disabled rules', () => {
    let result = compileNetworkAllowList({
      direction: 'egress',
      rules: [
        rule({
          effect: 'allow',
          direction: 'egress',
          priority: 10,
          cidrs: ['1.2.3.4/32'],
          ports: [{ from: 443, to: 443 }]
        }),
        rule({
          effect: 'allow',
          direction: 'ingress',
          priority: 20,
          cidrs: ['9.9.9.9/32']
        }),
        rule({
          effect: 'allow',
          direction: 'egress',
          priority: 30,
          cidrs: ['5.5.5.5/32'],
          enabled: false
        })
      ]
    });

    expect(result.entries).toEqual([
      { cidr: '1.2.3.4/32', portRange: { from: 443, to: 443 } }
    ]);
  });

  it('uses full port range for egress rules without ports', () => {
    let result = compileNetworkAllowList({
      direction: 'egress',
      rules: [
        rule({
          effect: 'allow',
          direction: 'egress',
          priority: 10,
          cidrs: ['0.0.0.0/0']
        })
      ]
    });

    expect(result.entries).toEqual([{ cidr: '0.0.0.0/0' }]);
  });

  it('does not collapse partial egress product coverage to the universe sentinel', () => {
    let result = compileNetworkAllowList({
      direction: 'egress',
      rules: [
        rule({
          id: 'npr_allow_https_everywhere',
          effect: 'allow',
          direction: 'egress',
          priority: 20,
          cidrs: ['0.0.0.0/0'],
          ports: [{ from: 443, to: 443 }]
        }),
        rule({
          id: 'npr_allow_private_all_ports',
          effect: 'allow',
          direction: 'egress',
          priority: 10,
          cidrs: ['10.0.0.0/8']
        })
      ]
    });

    expect(result.entries).toEqual([
      { cidr: '0.0.0.0/0', portRange: { from: 443, to: 443 } },
      { cidr: '10.0.0.0/8', portRange: { from: 1, to: 442 } },
      { cidr: '10.0.0.0/8', portRange: { from: 444, to: 65535 } }
    ]);
  });
});
