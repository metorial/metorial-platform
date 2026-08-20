import { describe, expect, it } from 'vitest';
import { signalSigningSecretContext } from './webhookDestinationSigningSecret';

describe('callback signing secret projection', () => {
  it('uses a distinct envelope for each callback destination webhook owner', () => {
    let base = {
      tenantId: 'tenant',
      webhookId: 'first',
      purpose: 'webhook_signing',
      secretVersion: 1,
      encryptionKeyVersion: 1,
      aadVersion: 1
    };
    expect(signalSigningSecretContext(base)).not.toBe(
      signalSigningSecretContext({ ...base, webhookId: 'second' })
    );
  });
});
