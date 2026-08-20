import { beforeEach, describe, expect, it, vi } from 'vitest';

let { getManaged } = vi.hoisted(() => ({ getManaged: vi.fn() }));
vi.mock('@metorial-subspace/module-auth', () => ({
  managedProviderAuthCredentialsService: {
    getManagedProviderAuthCredentialsById: getManaged
  }
}));

import { getManagedProviderAuthCredentialsControllerResponse } from '../managedProviderAuthCredentialsBoundary';

let record = {
  id: 'managed-1',
  status: 'active',
  name: 'Managed',
  description: null,
  metadata: null,
  oauthScopes: [],
  oauthClientId: 'client-id',
  oauthClientSecret: 'forbidden-legacy-plaintext',
  encryptedValue: 'forbidden-encrypted-envelope',
  encryptionKeyVersion: 2,
  sourceSecretId: 'forbidden-source-binding',
  provider: { id: 'provider-1' },
  providerAuthMethodGlobal: null,
  initialProviderAuthMethod: {
    id: 'method-1',
    name: 'OAuth',
    provider: { id: 'provider-1' }
  },
  createdAt: new Date('2026-08-14T00:00:00.000Z'),
  updatedAt: new Date('2026-08-14T00:00:00.000Z')
};

beforeEach(() => {
  getManaged.mockReset();
});

describe('managed credential controller tenant/redaction boundary', () => {
  it('invokes the tenant-scoped service and real presenter without secret leakage', async () => {
    let solution = { oid: 10n, id: 'solution-1' };
    getManaged.mockImplementation(async input => {
      if (input.solution !== solution) throw new Error('tenant solution binding denied');
      if (input.managedProviderAuthCredentialsId !== record.id) {
        throw new Error('managed credential owner not found');
      }
      return record;
    });

    let response = await getManagedProviderAuthCredentialsControllerResponse({
      solution: solution as never,
      managedProviderAuthCredentialsId: record.id
    });
    expect(getManaged).toHaveBeenCalledWith({
      solution,
      managedProviderAuthCredentialsId: record.id
    });
    let serialized = JSON.stringify(response);
    expect(serialized).not.toContain('forbidden-legacy-plaintext');
    expect(serialized).not.toContain('forbidden-encrypted-envelope');
    expect(serialized).not.toContain('encryptionKeyVersion');
    expect(serialized).not.toContain('sourceSecretId');
  });

  it('propagates cross-tenant and cross-owner service denials', async () => {
    getManaged.mockRejectedValueOnce(new Error('tenant solution binding denied'));
    await expect(
      getManagedProviderAuthCredentialsControllerResponse({
        solution: { oid: 99n, id: 'other-solution' } as never,
        managedProviderAuthCredentialsId: record.id
      })
    ).rejects.toThrow('tenant solution binding denied');

    getManaged.mockRejectedValueOnce(new Error('managed credential owner not found'));
    await expect(
      getManagedProviderAuthCredentialsControllerResponse({
        solution: { oid: 10n, id: 'solution-1' } as never,
        managedProviderAuthCredentialsId: 'managed-other'
      })
    ).rejects.toThrow('managed credential owner not found');
  });
});
