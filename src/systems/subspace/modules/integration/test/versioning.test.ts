import { describe, expect, it } from 'vitest';
import { hasMaterialIntegrationProviderChange } from '../src/lib/material';

let currentVersion = {
  deploymentOid: 1n,
  authMethodOid: 2n,
  authCredentialsOid: 3n,
  configOid: 4n,
  toolFilter: { type: 'v1.allow_all' }
};

describe('integration provider versioning', () => {
  it('does not version metadata-only updates', () => {
    expect(
      hasMaterialIntegrationProviderChange({
        currentVersion,
        input: {}
      })
    ).toBe(false);
  });

  it('versions deployment changes', () => {
    expect(
      hasMaterialIntegrationProviderChange({
        currentVersion,
        input: { deploymentOid: 5n }
      })
    ).toBe(true);
  });

  it('versions nullable auth/config changes', () => {
    expect(
      hasMaterialIntegrationProviderChange({
        currentVersion,
        input: { authMethodOid: null, authCredentialsOid: null, configOid: null }
      })
    ).toBe(true);
  });

  it('versions tool filter changes', () => {
    expect(
      hasMaterialIntegrationProviderChange({
        currentVersion,
        input: { toolFilter: { type: 'v1.deny_all' } }
      })
    ).toBe(true);
  });
});
