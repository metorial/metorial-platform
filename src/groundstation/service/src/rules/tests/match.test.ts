import { describe, expect, it } from 'vitest';
import {
  checkRegexPattern,
  evaluateMatch,
  globToRegExp,
  isMatchField,
  validateMatch
} from '../match';

let errorsOf = (value: unknown) => {
  let result = validateMatch(value);
  return result.success ? [] : result.errors;
};

describe('validateMatch', () => {
  it('accepts nested condition trees', () => {
    let match = {
      all: [
        { field: 'repo.owner', op: 'eq', value: 'acme' },
        {
          any: [
            { field: 'branch', op: 'glob', value: 'release/*' },
            { not: { field: 'tag.env', op: 'in', value: ['ci', 'staging'] } }
          ]
        },
        { field: 'ticket', op: 'exists' }
      ]
    };

    expect(validateMatch(match)).toEqual({ success: true, value: match });
  });

  it('accepts every documented field and tag fields', () => {
    for (let field of [
      'user',
      'device',
      'agent',
      'team',
      'repo',
      'repo.owner',
      'branch',
      'workspace',
      'ticket',
      'client.family',
      'client.surface',
      'model',
      'mcp.server',
      'project',
      'instance',
      'tag.team',
      'tag.metorial.project'
    ]) {
      expect(isMatchField(field)).toBe(true);
    }

    expect(isMatchField('tag.')).toBe(false);
    expect(isMatchField('cost')).toBe(false);
  });

  it('reports unknown fields with a path', () => {
    let errors = errorsOf({ all: [{ field: 'cost', op: 'eq', value: '1' }] });

    expect(errors).toEqual([
      expect.objectContaining({ code: 'invalid_match', path: ['all', '0', 'field'] })
    ]);
  });

  it('checks operator values', () => {
    expect(errorsOf({ field: 'repo', op: 'in', value: 'acme/api' })[0]?.path).toEqual([
      'value'
    ]);
    expect(errorsOf({ field: 'repo', op: 'eq', value: ['a'] })[0]?.path).toEqual(['value']);
    expect(errorsOf({ field: 'repo', op: 'exists', value: 'x' })[0]?.path).toEqual(['value']);
    expect(errorsOf({ field: 'repo', op: 'eq' })[0]?.path).toEqual(['value']);
    expect(errorsOf({ field: 'repo', op: 'like', value: 'x' }).length).toBeGreaterThan(0);
  });

  it('refuses mixed combinators and empty lists', () => {
    expect(errorsOf({ all: [], any: [] }).length).toBe(1);
    expect(errorsOf({ all: [] })[0]?.path).toEqual(['all']);
    expect(errorsOf({ not: { field: 'repo', op: 'exists' }, field: 'x' }).length).toBe(1);
    expect(errorsOf('repo').length).toBe(1);
  });

  it('caps depth and size', () => {
    let deep: unknown = { field: 'repo', op: 'exists' };
    for (let i = 0; i < 10; i++) deep = { not: deep };

    expect(errorsOf(deep)[0]?.message).toMatch(/nested/);

    let wide = {
      any: Array.from({ length: 4 }, () => ({
        all: Array.from({ length: 40 }, () => ({ field: 'repo', op: 'exists' }))
      }))
    };

    expect(errorsOf(wide)[0]?.message).toMatch(/at most 100/);
  });

  it('refuses unsafe or invalid regular expressions', () => {
    expect(checkRegexPattern('^acme-(api|web)$')).toBeNull();
    expect(checkRegexPattern('(a+)+$')).toMatch(/Nested/);
    expect(checkRegexPattern('(.*)*')).toMatch(/Nested/);
    expect(checkRegexPattern('([a-z]{1,5})+')).toMatch(/Nested/);
    expect(checkRegexPattern('(')).toMatch(/invalid/);
    expect(checkRegexPattern('a'.repeat(300))).toMatch(/limited/);

    expect(errorsOf({ field: 'branch', op: 'regex', value: '(a+)+' })[0]?.path).toEqual([
      'value'
    ]);
  });
});

describe('evaluateMatch', () => {
  let facts = {
    'repo.owner': ['acme', 'github/acme'],
    branch: ['release/2026-11'],
    team: ['ent_team_1', 'payments'],
    'tag.env': ['prod'],
    ticket: []
  };

  it('compares eq and in case-insensitively against any value', () => {
    expect(evaluateMatch({ field: 'repo.owner', op: 'eq', value: 'ACME' }, facts)).toBe(true);
    expect(evaluateMatch({ field: 'team', op: 'in', value: ['Payments', 'x'] }, facts)).toBe(
      true
    );
    expect(evaluateMatch({ field: 'team', op: 'eq', value: 'growth' }, facts)).toBe(false);
  });

  it('anchors globs and evaluates regular expressions', () => {
    expect(evaluateMatch({ field: 'branch', op: 'glob', value: 'release/*' }, facts)).toBe(
      true
    );
    expect(evaluateMatch({ field: 'branch', op: 'glob', value: 'release' }, facts)).toBe(
      false
    );
    expect(
      evaluateMatch({ field: 'branch', op: 'glob', value: 'release/2026-1?' }, facts)
    ).toBe(true);
    expect(
      evaluateMatch({ field: 'branch', op: 'regex', value: '^release/\\d+' }, facts)
    ).toBe(true);
    expect(evaluateMatch({ field: 'branch', op: 'regex', value: '(a+)+' }, facts)).toBe(false);
    expect(globToRegExp('a.b*').test('axb')).toBe(false);
  });

  it('treats exists as a non-empty value list', () => {
    expect(evaluateMatch({ field: 'tag.env', op: 'exists' }, facts)).toBe(true);
    expect(evaluateMatch({ field: 'ticket', op: 'exists' }, facts)).toBe(false);
    expect(evaluateMatch({ field: 'model', op: 'exists' }, facts)).toBe(false);
  });

  it('combines conditions', () => {
    expect(
      evaluateMatch(
        {
          all: [
            { field: 'repo.owner', op: 'eq', value: 'acme' },
            { not: { field: 'tag.env', op: 'eq', value: 'staging' } },
            {
              any: [
                { field: 'ticket', op: 'exists' },
                { field: 'team', op: 'eq', value: 'payments' }
              ]
            }
          ]
        },
        facts
      )
    ).toBe(true);

    expect(
      evaluateMatch(
        {
          all: [
            { field: 'repo.owner', op: 'eq', value: 'acme' },
            { field: 'ticket', op: 'exists' }
          ]
        },
        facts
      )
    ).toBe(false);
  });
});
