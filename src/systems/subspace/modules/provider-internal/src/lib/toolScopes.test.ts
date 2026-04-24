import { describe, expect, it } from 'vitest';
import {
  checkToolScopesSatisfied,
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
    expect(checkToolScopesSatisfied(tool, [])).toEqual({ allowed: false });
    expect(checkToolScopesSatisfied(tool, null)).toEqual({ allowed: false });
  });

  it('treats empty OR clauses as non-constraining', () => {
    let tool = createTool({
      AND: [{ OR: [] }, { OR: ['read:x'] }]
    });

    expect(checkToolScopesSatisfied(tool, ['read:x'])).toEqual({ allowed: true });
    expect(checkToolScopesSatisfied(tool, [])).toEqual({ allowed: false });
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

  it('filters out tools whose scope tree is unsatisfied', () => {
    expect(filterToolsByScopes([restricted, unrestricted], [])).toEqual([unrestricted]);
    expect(filterToolsByScopes([restricted, unrestricted], ['read:x'])).toEqual([
      restricted,
      unrestricted
    ]);
  });
});
