import { describe, expect, it } from 'vitest';
import {
  assertProviderConfigPatchGeneration,
  prepareProviderConfigBackingPatch
} from './providerConfigUpdate';

describe('provider config service patch boundary', () => {
  it('preserves the exact backing and patch contract', () => {
    expect(
      prepareProviderConfigBackingPatch({
        patch: { set: { endpoint: 'next' }, remove: ['secret'] },
        expectedGeneration: 8,
        fromVaultOid: null,
        hasProviderVariant: true,
        currentVersion: { slateInstanceOid: 12n, shuttleConfigOid: null }
      })
    ).toEqual({
      backing: { slateInstanceOid: 12n, shuttleConfigOid: null },
      patch: { set: { endpoint: 'next' }, remove: ['secret'] },
      expectedGeneration: 8
    });
  });

  it('rejects compare generation without a patch', () => {
    expect(() => assertProviderConfigPatchGeneration({ expectedGeneration: 1 })).toThrow();
  });

  it('rejects vault-backed and missing backing updates', () => {
    expect(() =>
      prepareProviderConfigBackingPatch({
        patch: { set: { endpoint: 'next' } },
        fromVaultOid: 1n,
        hasProviderVariant: true,
        currentVersion: { slateInstanceOid: 2n, shuttleConfigOid: null }
      })
    ).toThrow();
    expect(() =>
      prepareProviderConfigBackingPatch({
        patch: { set: { endpoint: 'next' } },
        fromVaultOid: null,
        hasProviderVariant: false,
        currentVersion: null
      })
    ).toThrow();
  });
});
