import { describe, expect, it } from 'vitest';
import {
  managedCredentialBackingContext,
  managedCredentialSourceContext
} from '../lib/managedProviderAuthCredentialsSecretContext';

describe('managed OAuth secret ownership', () => {
  it('keeps platform source and tenant projection contexts disjoint', () => {
    let source = managedCredentialSourceContext({
      managedCredentialsId: 'managed-1',
      providerId: 'provider-1',
      providerAuthMethodId: 'auth-1',
      purpose: 'oauth_client_secret',
      secretVersion: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    let backing = managedCredentialBackingContext({
      tenantId: 'tenant-1',
      managedCredentialsId: 'managed-1',
      backingOid: 1n,
      providerAuthCredentialsId: 'credential-1',
      sourceSecretId: 'source-1',
      sourceSecretVersion: 1,
      purpose: 'oauth_client_secret',
      secretVersion: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1
    });
    expect(source).not.toBe(backing);
    expect(source).not.toContain('tenant-1');
  });
});
