import { describe, expect, it } from 'vitest';
import {
  checkToolScopesSatisfied,
  checkToolScopesSatisfiedByAuthMethods,
  filterToolsByScopes,
  resolveGrantedScopes
} from './toolScopes';

let createTool = (scopes: PrismaJson.ActionScopes | undefined) =>
  ({
    id: 'ptl_x',
    value: {
      scopes
    }
  }) as any;

describe('checkToolScopesSatisfied', () => {
  it('allows tools without scope restrictions regardless of granted scopes', () => {
    expect(checkToolScopesSatisfied(createTool(undefined), [])).toEqual({ allowed: true });
    expect(checkToolScopesSatisfied(createTool(null), ['a'])).toEqual({ allowed: true });
    expect(checkToolScopesSatisfied(createTool({ AND: [] }), ['a'])).toEqual({
      allowed: true
    });
  });

  it('allows tools whose AND/OR scope tree is satisfied', () => {
    let tool = createTool({
      AND: [{ OR: ['read:x', 'admin'] }, { OR: ['write:y'] }]
    });

    expect(checkToolScopesSatisfied(tool, ['read:x', 'write:y'])).toEqual({ allowed: true });
    expect(checkToolScopesSatisfied(tool, ['admin', 'write:y'])).toEqual({ allowed: true });
  });

  it('denies tools when an AND clause is unsatisfied', () => {
    let tool = createTool({
      AND: [{ OR: ['read:x'] }, { OR: ['write:y'] }]
    });

    expect(checkToolScopesSatisfied(tool, ['read:x'])).toEqual({ allowed: false });
  });

  it('allows scoped tools when granted scopes are empty or missing', () => {
    let tool = createTool({
      AND: [{ OR: ['read:x'] }]
    });

    expect(checkToolScopesSatisfied(tool, [])).toEqual({ allowed: true });
    expect(checkToolScopesSatisfied(tool, null)).toEqual({ allowed: true });
    expect(checkToolScopesSatisfied(tool, undefined)).toEqual({ allowed: true });
  });

  it('treats empty OR clauses as non-constraining', () => {
    let tool = createTool({
      AND: [{ OR: [] }, { OR: ['read:x'] }]
    });

    expect(checkToolScopesSatisfied(tool, ['read:x'])).toEqual({ allowed: true });
    expect(checkToolScopesSatisfied(tool, [])).toEqual({ allowed: true });
  });
});

describe('checkToolScopesSatisfiedByAuthMethods', () => {
  let restricted = createTool({ AND: [{ OR: ['read:x'] }] });
  let unrestricted = createTool(null);

  it('allows scoped tools for a matching auth method', () => {
    expect(checkToolScopesSatisfiedByAuthMethods(restricted, [['read:x']])).toEqual({
      allowed: true
    });
  });

  it('denies scoped tools when any selected auth method lacks a required scope', () => {
    expect(
      checkToolScopesSatisfiedByAuthMethods(restricted, [['read:x'], ['write:y']])
    ).toEqual({ allowed: false });
  });

  it('checks OR alternatives per auth method instead of intersecting scopes', () => {
    let tool = createTool({ AND: [{ OR: ['channels:manage', 'channels:write'] }] });

    expect(
      checkToolScopesSatisfiedByAuthMethods(tool, [['channels:manage'], ['channels:write']])
    ).toEqual({ allowed: true });
  });

  it('ignores auth methods without declared scopes', () => {
    expect(checkToolScopesSatisfiedByAuthMethods(unrestricted, [[], null])).toEqual({
      allowed: true
    });
    expect(checkToolScopesSatisfiedByAuthMethods(restricted, [[], null])).toEqual({
      allowed: true
    });
    expect(checkToolScopesSatisfiedByAuthMethods(restricted, [[], null, ['read:x']])).toEqual({
      allowed: true
    });
  });
});

describe('resolveGrantedScopes', () => {
  it('prefers credentials scopes over auth config scopes', () => {
    expect(
      resolveGrantedScopes({
        authConfig: { scopes: ['a', 'b'] },
        authCredentials: { scopes: ['a'] }
      })
    ).toEqual(['a']);
  });

  it('falls back to auth config scopes when credentials are missing', () => {
    expect(
      resolveGrantedScopes({
        authConfig: { scopes: ['a', 'b'] },
        authCredentials: null
      })
    ).toEqual(['a', 'b']);
  });

  it('treats empty scope arrays as unknown while scope sync is pending', () => {
    expect(
      resolveGrantedScopes({
        authConfig: { scopes: [] },
        authCredentials: null
      })
    ).toBeNull();

    expect(
      resolveGrantedScopes({
        authConfig: { scopes: [], needsScopeSync: true },
        authCredentials: null
      })
    ).toBeNull();
  });

  it('treats empty scope arrays as unknown even after scope sync', () => {
    expect(
      resolveGrantedScopes({
        authConfig: { scopes: [], needsScopeSync: false },
        authCredentials: null
      })
    ).toBeNull();

    expect(
      resolveGrantedScopes({
        authConfig: { scopes: ['a', 'b'] },
        authCredentials: { scopes: [], needsScopeSync: false }
      })
    ).toEqual(['a', 'b']);

    expect(
      resolveGrantedScopes({
        authConfig: { scopes: [], needsScopeSync: false },
        authCredentials: { scopes: ['a'] }
      })
    ).toEqual(['a']);
  });

  it('returns null when neither source is available', () => {
    expect(resolveGrantedScopes({})).toBeNull();
    expect(resolveGrantedScopes({ authConfig: null, authCredentials: null })).toBeNull();
  });
});

describe('filterToolsByScopes', () => {
  let restricted = createTool({ AND: [{ OR: ['read:x'] }] });
  let unrestricted = createTool(null);

  it('returns the original list when scopes are null', () => {
    let tools = [restricted, unrestricted];
    expect(filterToolsByScopes(tools, null)).toBe(tools);
    expect(filterToolsByScopes(tools, undefined)).toBe(tools);
  });

  it('returns the original list when scopes are empty', () => {
    let tools = [restricted, unrestricted];
    expect(filterToolsByScopes(tools, [])).toBe(tools);
  });

  it('filters out tools whose scope tree is unsatisfied by non-empty scopes', () => {
    expect(filterToolsByScopes([restricted, unrestricted], ['read:x'])).toEqual([
      restricted,
      unrestricted
    ]);
  });
});
