import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({
  ProviderAuthMethodType: {
    oauth: 'oauth',
    token: 'token',
    service_account: 'service_account',
    custom: 'custom'
  }
}));

vi.mock(
  '@metorial-subspace/module-provider-internal',
  async () =>
    await import('@metorial-subspace/module-provider-internal/src/lib/providerVersionSource')
);

import {
  matchProviderAuthMethodInSpecification,
  resolveEffectiveProviderAuthMethod
} from './effectiveProviderAuthMethod';

let timestamp = new Date('2026-01-01T00:00:00Z');

let authMethod = (d: {
  id: string;
  globalOid: bigint;
  key: string;
  type?: 'oauth' | 'token';
  isDefault?: boolean;
  createdAt?: Date;
}) => ({
  id: d.id,
  globalOid: d.globalOid,
  specId: `spec_${d.key}`,
  specUniqueIdentifier: `unique_${d.key}`,
  key: d.key,
  callableId: `callable_${d.key}`,
  type: d.type ?? ('oauth' as const),
  isDefault: d.isDefault ?? false,
  createdAt: d.createdAt ?? timestamp
});

let pinned = authMethod({ id: 'pam_pinned', globalOid: 1n, key: 'oauth' });

let version = (authMethods: ReturnType<typeof authMethod>[] | null) => ({
  specification: authMethods && { providerAuthMethods: authMethods }
});

let deployment = (d: {
  locked?: ReturnType<typeof version>;
  current?: ReturnType<typeof version> | null;
  hasEnvironments?: boolean;
  defaultVariantOid?: bigint | null;
}) => ({
  currentVersion: d.locked
    ? { lockedVersionOid: 20n, lockedVersion: d.locked }
    : { lockedVersionOid: null, lockedVersion: null },
  provider: {
    defaultVariantOid: d.defaultVariantOid === undefined ? 10n : d.defaultVariantOid,
    hasEnvironments: d.hasEnvironments ?? false,
    defaultVariant: { currentVersion: d.current ?? null }
  }
});

describe('matchProviderAuthMethodInSpecification', () => {
  it.each([
    ['id', 'pam_new'],
    ['spec id', 'spec_oauth'],
    ['unique identifier', 'unique_oauth'],
    ['key', 'oauth'],
    ['callable id', 'callable_oauth'],
    ['type', 'oauth']
  ])('matches the requested %s directly', (_, authMethodId) => {
    let candidate = authMethod({ id: 'pam_new', globalOid: 2n, key: 'oauth' });

    expect(
      matchProviderAuthMethodInSpecification({
        authMethodId,
        specificationAuthMethods: [candidate],
        previousAuthMethod: null
      })
    ).toBe(candidate);
  });

  it('prefers the default, then the oldest, auth method among direct matches', () => {
    let newer = authMethod({
      id: 'pam_newer',
      globalOid: 2n,
      key: 'a',
      createdAt: new Date('2026-02-01T00:00:00Z')
    });
    let older = authMethod({ id: 'pam_older', globalOid: 3n, key: 'b' });
    let preferred = authMethod({
      id: 'pam_default',
      globalOid: 4n,
      key: 'c',
      isDefault: true,
      createdAt: new Date('2026-03-01T00:00:00Z')
    });

    expect(
      matchProviderAuthMethodInSpecification({
        authMethodId: 'oauth',
        specificationAuthMethods: [newer, older, preferred],
        previousAuthMethod: null
      })
    ).toBe(preferred);
    expect(
      matchProviderAuthMethodInSpecification({
        authMethodId: 'oauth',
        specificationAuthMethods: [newer, older],
        previousAuthMethod: null
      })
    ).toBe(older);
  });

  it('re-matches the previous auth method by global identity, then key, then type', () => {
    let sameGlobal = authMethod({ id: 'pam_global', globalOid: 1n, key: 'renamed' });
    let sameKey = authMethod({ id: 'pam_key', globalOid: 2n, key: 'oauth' });
    let sameType = authMethod({
      id: 'pam_type',
      globalOid: 3n,
      key: 'other',
      isDefault: true
    });
    let otherType = authMethod({
      id: 'pam_token',
      globalOid: 4n,
      key: 'token',
      type: 'token'
    });

    let match = (specificationAuthMethods: ReturnType<typeof authMethod>[]) =>
      matchProviderAuthMethodInSpecification({
        authMethodId: pinned.id,
        specificationAuthMethods,
        previousAuthMethod: pinned
      });

    expect(match([sameType, sameKey, sameGlobal])).toBe(sameGlobal);
    expect(match([sameType, sameKey])).toBe(sameKey);
    expect(match([otherType, sameType])).toBe(sameType);
    expect(match([otherType])).toBeNull();
  });

  it('returns null without a previous auth method to re-match', () => {
    expect(
      matchProviderAuthMethodInSpecification({
        authMethodId: 'pam_missing',
        specificationAuthMethods: [authMethod({ id: 'pam_new', globalOid: 2n, key: 'oauth' })],
        previousAuthMethod: null
      })
    ).toBeNull();
  });
});

describe('resolveEffectiveProviderAuthMethod', () => {
  let lockedMatch = authMethod({ id: 'pam_locked', globalOid: 1n, key: 'oauth' });
  let currentMatch = authMethod({ id: 'pam_current', globalOid: 1n, key: 'oauth' });

  it('resolves against the locked version of a locked deployment', () => {
    expect(
      resolveEffectiveProviderAuthMethod({
        authMethod: pinned,
        deployment: deployment({
          locked: version([lockedMatch]),
          current: version([currentMatch])
        })
      })
    ).toEqual({ type: 'resolved', authMethod: lockedMatch });
  });

  it("resolves against the provider's current version otherwise", () => {
    expect(
      resolveEffectiveProviderAuthMethod({
        authMethod: pinned,
        deployment: deployment({ current: version([currentMatch]) })
      })
    ).toEqual({ type: 'resolved', authMethod: currentMatch });
  });

  it.each([
    ['the provider resolves versions per environment', { hasEnvironments: true }],
    ['the version specification is not discovered', { current: version(null) }]
  ])('is unresolved when %s', (_, overrides) => {
    expect(
      resolveEffectiveProviderAuthMethod({
        authMethod: pinned,
        deployment: deployment({ current: version([currentMatch]), ...overrides })
      })
    ).toEqual({ type: 'unresolved' });
  });

  it.each([
    ['the provider has no default variant', { defaultVariantOid: null }],
    ['the provider has no current version', { current: null }]
  ])('resolves to no auth method when %s', (_, overrides) => {
    expect(
      resolveEffectiveProviderAuthMethod({
        authMethod: pinned,
        deployment: deployment(overrides)
      })
    ).toEqual({ type: 'resolved', authMethod: null });
  });
});
