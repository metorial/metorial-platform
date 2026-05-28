import { describe, expect, it } from 'vitest';
import { validateNetworkPolicyRules } from './networkPolicyValidation';

let baseRule = {
  id: 'rule_1',
  effect: 'allow' as const,
  direction: 'ingress' as const,
  cidrs: ['198.51.100.0/24'],
  enabled: true,
  priority: 10
};

describe('validateNetworkPolicyRules', () => {
  it('accepts valid ingress rules', () => {
    expect(validateNetworkPolicyRules([baseRule])).toEqual([baseRule]);
  });

  it('accepts egress rules with ports', () => {
    let rules = [
      {
        ...baseRule,
        id: 'rule_egress',
        direction: 'egress' as const,
        ports: [{ from: 443, to: 443 }]
      }
    ];

    expect(validateNetworkPolicyRules(rules)).toEqual(rules);
  });

  it('rejects invalid CIDRs', () => {
    expect(() =>
      validateNetworkPolicyRules([
        {
          ...baseRule,
          cidrs: ['not-a-cidr']
        }
      ])
    ).toThrow(/invalid CIDR/i);
  });

  it('rejects ports on ingress rules', () => {
    expect(() =>
      validateNetworkPolicyRules([
        {
          ...baseRule,
          ports: [{ from: 80, to: 80 }]
        }
      ])
    ).toThrow(/egress rules/i);
  });

  it('rejects duplicate rule ids', () => {
    expect(() =>
      validateNetworkPolicyRules([
        baseRule,
        {
          ...baseRule,
          cidrs: ['203.0.113.0/24']
        }
      ])
    ).toThrow(/Duplicate network policy rule id/i);
  });

  it('rejects invalid port ranges', () => {
    expect(() =>
      validateNetworkPolicyRules([
        {
          ...baseRule,
          id: 'rule_ports',
          direction: 'egress' as const,
          ports: [{ from: 70000, to: 70001 }]
        }
      ])
    ).toThrow(/invalid port range/i);
  });
});
