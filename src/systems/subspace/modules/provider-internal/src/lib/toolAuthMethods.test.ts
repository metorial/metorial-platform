import { describe, expect, it } from 'vitest';
import { checkToolAuthMethodSatisfied, filterToolsByAuthMethod } from './toolAuthMethods';

let createTool = (authMethods?: string[] | null) =>
  ({
    id: 'ptl_x',
    value: {
      authMethods
    }
  }) as any;

describe('checkToolAuthMethodSatisfied', () => {
  it('allows tools without auth method restrictions', () => {
    expect(checkToolAuthMethodSatisfied(createTool(undefined), null)).toEqual({ allowed: true });
    expect(checkToolAuthMethodSatisfied(createTool(null), { key: 'token_auth' })).toEqual({
      allowed: true
    });
    expect(checkToolAuthMethodSatisfied(createTool([]), { key: 'token_auth' })).toEqual({
      allowed: true
    });
  });

  it('allows tools when the active auth method key is listed', () => {
    expect(
      checkToolAuthMethodSatisfied(createTool(['token_auth', 'service_account']), {
        key: 'service_account'
      })
    ).toEqual({ allowed: true });
  });

  it('denies tools when the active auth method is missing or different', () => {
    expect(checkToolAuthMethodSatisfied(createTool(['token_auth']), null)).toEqual({
      allowed: false
    });
    expect(checkToolAuthMethodSatisfied(createTool(['token_auth']), { key: 'oauth' })).toEqual({
      allowed: false
    });
  });
});

describe('filterToolsByAuthMethod', () => {
  it('filters out tools unavailable for the active auth method', () => {
    let tokenOnly = createTool(['token_auth']);
    let oauthOnly = createTool(['oauth']);
    let unrestricted = createTool(null);

    expect(filterToolsByAuthMethod([tokenOnly, oauthOnly, unrestricted], { key: 'token_auth' }))
      .toEqual([tokenOnly, unrestricted]);
  });
});
