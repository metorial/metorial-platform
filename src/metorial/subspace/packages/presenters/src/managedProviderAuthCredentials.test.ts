import { describe, expect, it } from 'vitest';
import { managedProviderAuthCredentialsPresenter } from './managedProviderAuthCredentials';

describe('managedProviderAuthCredentialsPresenter', () => {
  it('redacts legacy plaintext and every encrypted source/backing field', () => {
    let record = {
      id: 'managed-1',
      status: 'active',
      name: 'Managed',
      description: null,
      metadata: null,
      oauthScopes: [],
      oauthClientId: 'client',
      oauthClientSecret: 'forbidden-plaintext',
      provider: { id: 'provider-1' },
      providerAuthMethodGlobal: null,
      initialProviderAuthMethod: {
        id: 'method-1',
        name: 'OAuth',
        provider: { id: 'provider-1' }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    } as any;
    let serialized = JSON.stringify(managedProviderAuthCredentialsPresenter(record));
    expect(serialized).not.toContain('forbidden-plaintext');
    expect(serialized).not.toContain('encryptedValue');
    expect(serialized).not.toContain('encryptionKeyVersion');
    expect(serialized).not.toContain('sourceSecretId');
  });
});
