import { beforeEach, describe, expect, it, vi } from 'vitest';

let db = {
  slate: { findUniqueOrThrow: vi.fn() },
  slateOAuthCredentials: { findFirst: vi.fn() },
  slateWebhookRegistration: { create: vi.fn() }
};

let createReceiver = vi.fn();

vi.mock('@metorial-subspace/db', () => ({ db, snowflake: { nextId: () => 100n } }));

vi.mock('@metorial-subspace/provider-utils', () => ({ IProviderCallbacks: class {} }));

vi.mock('../client', () => ({
  getTenantForSlates: async () => ({ id: 'hub_tenant' }),
  slates: { slateWebhookRegistration: { create: createReceiver } }
}));

describe('credential-scoped webhook receivers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.slate.findUniqueOrThrow.mockResolvedValue({ oid: 2n, id: 'slack' });
    createReceiver.mockResolvedValue({
      webhookRegistration: {
        id: 'receiver',
        triggerGroupKey: 'events',
        urlKey: 'url',
        receiveUrl: 'https://example.test/receiver'
      },
      webhookSetupDocument: 'Configure the app.'
    });
  });

  let create = async (providerAuthCredentials?: { slateCredentialsOid: bigint | null }) => {
    let { ProviderCallbacks } = await import('./callback');
    let callbacks = new ProviderCallbacks({ backend: {} as any });

    return callbacks.createWebhookRegistration({
      tenant: { oid: 1n } as any,
      provider: {} as any,
      providerVariant: { slateOid: 2n } as any,
      webhookRegistration: { oid: 3n, name: 'Slack Receiver' } as any,
      providerAuthCredentials: providerAuthCredentials as any
    });
  };

  it.each([
    { oid: 11n, id: 'oauth_app_1' },
    { oid: 12n, id: 'oauth_app_2' }
  ])('restricts the receiver to $id', async credential => {
    db.slateOAuthCredentials.findFirst.mockResolvedValue(credential);

    await create({ slateCredentialsOid: credential.oid });

    expect(db.slateOAuthCredentials.findFirst).toHaveBeenCalledWith({
      where: { oid: credential.oid, tenantOid: 1n, slateOid: 2n }
    });
    expect(createReceiver).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'hub_tenant',
        slateId: 'slack',
        authRouting: 'restricted_credential',
        slateOAuthCredentialsIds: [credential.id]
      })
    );
  });

  it('preserves shared routing when no credential is supplied', async () => {
    await create();

    expect(createReceiver).toHaveBeenCalledWith(
      expect.objectContaining({ authRouting: 'any', slateOAuthCredentialsIds: undefined })
    );
    expect(db.slateOAuthCredentials.findFirst).not.toHaveBeenCalled();
  });

  it.each([null, 99n])(
    'does not fall back to shared routing for an invalid backing: %s',
    async oid => {
      db.slateOAuthCredentials.findFirst.mockResolvedValue(null);

      await expect(create({ slateCredentialsOid: oid })).rejects.toThrow(
        'These credentials cannot be used'
      );

      expect(createReceiver).not.toHaveBeenCalled();
      expect(db.slateWebhookRegistration.create).not.toHaveBeenCalled();
    }
  );
});
