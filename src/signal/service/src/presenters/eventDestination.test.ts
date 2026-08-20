import { describe, expect, it } from 'vitest';
import { eventDestinationPresenter } from './eventDestination';

describe('eventDestinationPresenter secret redaction', () => {
  it('does not expose plaintext, ciphertext, or envelope metadata', () => {
    let presented = eventDestinationPresenter({
      id: 'destination',
      externalId: null,
      name: 'Destination',
      description: null,
      type: 'http_endpoint',
      eventTypes: [],
      hasEventTypesFilter: false,
      retryType: 'linear',
      retryMaxAttempts: 3,
      retryDelaySeconds: 1,
      currentInstance: {
        webhook: {
          id: 'webhook',
          url: 'https://example.test',
          method: 'POST',
          signingSecret: 'forbidden-plaintext',
          oid: 2n,
          tenantOid: 1n,
          createdAt: new Date()
        }
      } as any,
      oid: 1n,
      status: 'active',
      isCallbackDestination: false,
      tenantOid: 1n,
      senderOid: 1n,
      currentInstanceOid: 1n,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      lastActiveAt: null,
      expiresAt: null
    });
    let serialized = JSON.stringify(presented);
    expect(serialized).not.toContain('forbidden-plaintext');
    expect(serialized).not.toContain('encryptedValue');
    expect(serialized).not.toContain('encryptionKeyVersion');
    expect(presented.webhook?.signingSecretConfigured).toBe(true);
  });
});
