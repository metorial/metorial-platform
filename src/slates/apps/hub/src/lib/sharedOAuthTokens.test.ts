import { describe, expect, it } from 'vitest';
import {
  changedOutputEntries,
  getRefreshToken,
  sharedOAuthRefreshLockKey
} from './sharedOAuthTokens';

let identity = {
  authConfigOid: 1n,
  slateOid: 10n,
  authMethodKey: 'oauth',
  clientId: 'client-1',
  profileUid: 'U123'
};

describe('sharedOAuthRefreshLockKey', () => {
  it('is the same for configs of one provider identity', () => {
    expect(sharedOAuthRefreshLockKey(identity, true)).toBe(
      sharedOAuthRefreshLockKey({ ...identity, authConfigOid: 2n }, true)
    );
  });

  it('differs when the OAuth client or profile differs', () => {
    let key = sharedOAuthRefreshLockKey(identity, true);
    expect(sharedOAuthRefreshLockKey({ ...identity, clientId: 'client-2' }, true)).not.toBe(
      key
    );
    expect(sharedOAuthRefreshLockKey({ ...identity, profileUid: 'U999' }, true)).not.toBe(key);
  });

  it('uses a per-config key without a profile or without token sync', () => {
    expect(sharedOAuthRefreshLockKey({ ...identity, profileUid: null }, true)).toBe('cfg:1');
    expect(sharedOAuthRefreshLockKey(identity, false)).toBe('cfg:1');
  });
});

describe('getRefreshToken', () => {
  it('returns only non-empty string refresh tokens', () => {
    expect(getRefreshToken({ refreshToken: 'r1' })).toBe('r1');
    expect(getRefreshToken({ refreshToken: '' })).toBeNull();
    expect(getRefreshToken({ refreshToken: 42 })).toBeNull();
    expect(getRefreshToken(undefined)).toBeNull();
  });
});

describe('changedOutputEntries', () => {
  it('keeps only keys the refresh changed', () => {
    expect(
      changedOutputEntries(
        { token: 'a1', refreshToken: 'r1', expiresAt: 't1', userId: 'U1', teamId: 'T1' },
        { token: 'a2', refreshToken: 'r2', expiresAt: 't2', userId: 'U1', teamId: 'T1' }
      )
    ).toEqual({ token: 'a2', refreshToken: 'r2', expiresAt: 't2' });
  });

  it('ignores undefined values and handles a missing previous output', () => {
    expect(changedOutputEntries(undefined, { token: 'a', extra: undefined })).toEqual({
      token: 'a'
    });
    expect(changedOutputEntries({ token: 'a' }, undefined)).toEqual({});
  });
});
