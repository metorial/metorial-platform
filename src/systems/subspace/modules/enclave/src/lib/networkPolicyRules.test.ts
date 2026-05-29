import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({
  getId: (model: string) => ({
    oid: BigInt(1),
    id: `${model}_generated`
  })
}));

import {
  assignNetworkPolicyRuleIds,
  createNetworkPolicyRule,
  rulesContentEqual
} from './networkPolicyRules';

let baseRuleInput = {
  effect: 'allow' as const,
  direction: 'ingress' as const,
  cidrs: ['198.51.100.0/24'],
  enabled: true,
  priority: 10
};

describe('networkPolicyRules', () => {
  it('assigns generated ids to new rules', () => {
    let rules = assignNetworkPolicyRuleIds([baseRuleInput]);

    expect(rules).toEqual([
      {
        ...baseRuleInput,
        id: 'networkPolicyRule_generated'
      }
    ]);
  });

  it('reuses ids for unchanged rules', () => {
    let current = [
      {
        ...baseRuleInput,
        id: 'npr_existing'
      }
    ];

    let rules = assignNetworkPolicyRuleIds(
      [
        baseRuleInput,
        {
          ...baseRuleInput,
          direction: 'egress' as const,
          cidrs: ['203.0.113.0/24'],
          ports: [{ from: 443, to: 443 }]
        }
      ],
      current
    );

    expect(rules[0]?.id).toBe('npr_existing');
    expect(rules[1]?.id).toBe('networkPolicyRule_generated');
  });

  it('treats trimmed descriptions as equal', () => {
    expect(
      rulesContentEqual(
        { ...baseRuleInput, description: ' office ' },
        { ...baseRuleInput, description: 'office' }
      )
    ).toBe(true);
  });

  it('creates a single rule with a generated id', () => {
    expect(createNetworkPolicyRule(baseRuleInput)).toMatchObject({
      ...baseRuleInput,
      id: 'networkPolicyRule_generated'
    });
  });
});
