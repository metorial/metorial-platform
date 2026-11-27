import type { SecurityReviewAction } from '@metorial-subspace/db';
import { describe, expect, it } from 'vitest';
import { actionsExposure } from './actionRules';

let action = (overrides: Partial<SecurityReviewAction>): SecurityReviewAction => ({
  operation: 'read',
  scope: 'selected_resource',
  data: 'user_provided',
  destination: 'none',
  target: 'Selected resource',
  evidence: [],
  ...overrides
});

describe('capability calibration across skills and integrations', () => {
  it.each([
    {
      name: 'drafting from supplied notes',
      value: action({ scope: 'provided_data' }),
      expected: 'low'
    },
    {
      name: 'writing a requested project artifact',
      value: action({ operation: 'write', scope: 'workspace' }),
      expected: 'low'
    },
    {
      name: 'bounded local computation',
      value: action({ operation: 'execute', scope: 'provided_data' }),
      expected: 'low'
    },
    {
      name: 'editing a connected account record',
      value: action({ operation: 'write', scope: 'account', data: 'private' }),
      expected: 'moderate'
    },
    {
      name: 'sending an expected Slack notification',
      value: action({ operation: 'send', destination: 'expected_service' }),
      expected: 'moderate'
    },
    {
      name: 'reading an account-wide private corpus',
      value: action({ scope: 'account', data: 'private' }),
      expected: 'high'
    },
    {
      name: 'deleting account resources',
      value: action({ operation: 'delete', scope: 'account' }),
      expected: 'high'
    },
    {
      name: 'arbitrary shell execution',
      value: action({ operation: 'execute', scope: 'unrestricted' }),
      expected: 'high'
    },
    {
      name: 'arbitrary shell execution with otherwise unknown data',
      value: action({ operation: 'execute', scope: 'unrestricted', data: 'unknown' }),
      expected: 'high'
    },
    {
      name: 'moving money',
      value: action({ operation: 'financial', scope: 'account' }),
      expected: 'critical'
    },
    {
      name: 'changing access controls',
      value: action({ operation: 'access_control', scope: 'account' }),
      expected: 'critical'
    },
    {
      name: 'sending credentials',
      value: action({ operation: 'send', data: 'credentials', destination: 'unknown' }),
      expected: 'critical'
    },
    { name: 'unexamined reach', value: action({ scope: 'unknown' }), expected: 'unknown' }
  ])('$name', ({ value, expected }) => {
    expect(actionsExposure([value])).toBe(expected);
  });

  it('preserves a known dangerous lower bound when another action is unknown', () => {
    expect(
      actionsExposure([action({ operation: 'financial' }), action({ scope: 'unknown' })])
    ).toBe('critical');
    expect(actionsExposure([action({}), action({ scope: 'unknown' })])).toBe('unknown');
  });
});
