import { describe, expect, it } from 'vitest';
import { validateNetworkPolicyRuleInput, validateNetworkPolicyRules } from './networkPolicyValidation';

let baseRuleInput = {
  effect: 'allow' as const,
  direction: 'ingress' as const,
  cidrs: ['198.51.100.0/24'],
  enabled: true,
  priority: 10
};

describe('validateNetworkPolicyRuleInput', () => {
  it('accepts valid ingress rules without an id', () => {
    expect(validateNetworkPolicyRuleInput(baseRuleInput)).toBeUndefined();
  });

  it('accepts egress rules with ports', () => {
    expect(
      validateNetworkPolicyRuleInput({
        ...baseRuleInput,
        direction: 'egress',
        ports: [{ from: 443, to: 443 }]
      })
    ).toBeUndefined();
  });

  it('rejects invalid CIDRs', () => {
    expect(() =>
      validateNetworkPolicyRuleInput({
        ...baseRuleInput,
        cidrs: ['not-a-cidr']
      })
    ).toThrow(/invalid CIDR/i);
  });

  it('rejects ports on ingress rules', () => {
    expect(() =>
      validateNetworkPolicyRuleInput({
        ...baseRuleInput,
        ports: [{ from: 80, to: 80 }]
      })
    ).toThrow(/egress rules/i);
  });
});

describe('validateNetworkPolicyRules', () => {
  it('rejects duplicate stored rule ids', () => {
    expect(() =>
      validateNetworkPolicyRules([
        { ...baseRuleInput, id: 'npr_one' },
        { ...baseRuleInput, id: 'npr_one', cidrs: ['203.0.113.0/24'] }
      ])
    ).toThrow(/Duplicate network policy rule id/i);
  });
});
