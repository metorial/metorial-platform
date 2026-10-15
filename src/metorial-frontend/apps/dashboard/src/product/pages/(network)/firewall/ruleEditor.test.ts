import { describe, expect, it } from 'vitest';
import {
  movePolicyRule,
  policyRuleInput,
  nextRulePriority,
  parseAddresses,
  parseRulePorts,
  ruleValues,
  sortRules,
  summarizeRule,
  toRuleInput
} from './ruleEditor';

describe('network rule inputs', () => {
  it('normalizes individual addresses and preserves IPv4 and IPv6 networks', () => {
    expect(parseAddresses('203.0.113.5, 2001:db8::1, 10.0.0.0/8, ::/0')).toEqual([
      '203.0.113.5/32',
      '2001:db8::1/128',
      '10.0.0.0/8',
      '::/0'
    ]);
    expect(parseAddresses('::ffff:192.0.2.1')).toEqual(['::ffff:192.0.2.1/128']);
  });

  it.each([
    '',
    '300.1.1.1',
    '10.0.0.1/33',
    '::1/129',
    '1::2::3',
    ':::',
    '1:2:3',
    '1.2.3.4/1/2',
    '1.2.3.4,'
  ])('rejects invalid addresses: %s', value => {
    expect(() => parseAddresses(value)).toThrow();
  });

  it('parses every single port and range', () => {
    expect(parseRulePorts('443, 8000-9000, 1, 65535')).toEqual([
      { from: 443, to: 443 },
      { from: 8000, to: 9000 },
      { from: 1, to: 1 },
      { from: 65535, to: 65535 }
    ]);
  });

  it.each(['', '0', '65536', '9000-8000', '443,', '1.5', '-1', '80-'])(
    'rejects invalid ports: %s',
    value => {
      expect(() => parseRulePorts(value)).toThrow();
    }
  );

  it('round-trips a disabled rule with several networks and port ranges', () => {
    let rule = {
      effect: 'deny' as const,
      direction: 'egress' as const,
      cidrs: ['10.0.0.0/8', '2001:db8::/32'],
      ports: [
        { from: 443, to: 443 },
        { from: 8000, to: 9000 }
      ],
      enabled: false,
      priority: 250,
      description: 'Restricted'
    };

    expect(toRuleInput(ruleValues(rule))).toEqual(rule);
  });

  it('requires an explicit address choice and supports both address families', () => {
    expect(() => toRuleInput(ruleValues())).toThrow();
    expect(toRuleInput({ ...ruleValues(), addressMode: 'any' }).cidrs).toEqual([
      '0.0.0.0/0',
      '::/0'
    ]);
  });

  it('omits ports for incoming traffic even when hidden outgoing inputs are invalid', () => {
    expect(
      toRuleInput({
        ...ruleValues(),
        direction: 'ingress',
        addressMode: 'any',
        portMode: 'specific',
        ports: 'invalid'
      }).ports
    ).toBeUndefined();
  });

  it('sorts by precedence without mutating rules or changing tie order', () => {
    let rules = [
      { id: 'first', priority: 100 },
      { id: 'highest', priority: 300 },
      { id: 'tie', priority: 100 }
    ];

    expect(sortRules(rules).map(rule => rule.id)).toEqual(['highest', 'first', 'tie']);
    expect(rules[0].id).toBe('first');
    expect(nextRulePriority(rules)).toBe(301);
    expect(nextRulePriority([])).toBe(100);
  });

  it('describes traffic and ports in plain language', () => {
    expect(summarizeRule({ direction: 'egress', cidrs: ['0.0.0.0/0'] })).toBe(
      'Outgoing traffic to any IPv4 address · All ports'
    );
    expect(summarizeRule({ direction: 'ingress', cidrs: ['::/0'] })).toBe(
      'Incoming traffic from any IPv6 address'
    );
    expect(
      summarizeRule({
        direction: 'egress',
        cidrs: ['10.0.0.0/8'],
        ports: [
          { from: 443, to: 443 },
          { from: 8000, to: 9000 }
        ]
      })
    ).toContain('Ports 443, 8000-9000');
  });
});

describe('policy rule ordering', () => {
  it('swaps rule positions while preserving the policy priority slots and rule data', () => {
    let rules = [
      { id: 'first', priority: 300, enabled: false, cidrs: ['10.0.0.0/8'] },
      { id: 'second', priority: 100, enabled: true, cidrs: ['::/0'] }
    ];
    let moved = movePolicyRule(rules, 'second', -1);

    expect(moved.map(rule => rule.id)).toEqual(['second', 'first']);
    expect(moved.map(rule => rule.priority)).toEqual([300, 100]);
    expect(moved[1].enabled).toBe(false);
    expect(moved[1].cidrs).toEqual(['10.0.0.0/8']);
    expect(rules[0].priority).toBe(300);
  });

  it('preserves tie ordering and treats moves beyond list boundaries as no-ops', () => {
    let rules = [
      { id: 'a', priority: 100 },
      { id: 'b', priority: 100 }
    ];

    expect(sortRules(movePolicyRule(rules, 'b', -1)).map(rule => rule.id)).toEqual(['b', 'a']);
    expect(movePolicyRule(rules, 'a', -1)).toEqual(rules);
    expect(movePolicyRule(rules, 'b', 1)).toEqual(rules);
  });

  it('serializes reordered rules without losing descriptions, disabled state or multiple port ranges', () => {
    let input = policyRuleInput({
      effect: 'deny',
      direction: 'egress',
      cidrs: ['10.0.0.0/8'],
      enabled: false,
      priority: 200,
      description: 'Restricted',
      ports: [
        { from: 443, to: 443 },
        { from: 8000, to: 9000 }
      ]
    });

    expect(input.enabled).toBe(false);
    expect(input.description).toBe('Restricted');
    expect(input.ports).toHaveLength(2);
  });
});
