import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({ getOAuthCallbackUrl: async () => null }));
vi.mock('@metorial/db', () => ({}));

import { v1ProviderTypePresenter } from './providerType';

let present = async (triggers: PrismaJson.ProviderTypeAttributes['triggers'] | object) => {
  let presented = await v1ProviderTypePresenter
    .present(
      {
        providerType: {
          id: 'pty_1',
          name: 'Slates',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          attributes: {
            provider: 'metorial-slates',
            backend: 'slates',
            triggers,
            auth: { status: 'disabled' },
            config: { status: 'disabled' }
          }
        },
        provider: {}
      } as any,
      { apiVersion: 'mt_2025_01_01_dashboard', accessType: 'user_auth_token' }
    )
    .run();

  return presented.triggers;
};

describe('provider type webhook registration', () => {
  it('presents a provider with a manual group as a webhook receiver provider', async () => {
    expect(
      await present({ status: 'enabled', webhookRegistration: { status: 'supported' } })
    ).toEqual({
      status: 'enabled',
      webhook_registration: { status: 'supported', purpose: 'webhook_receiver' }
    });
  });

  it('presents an automatic provider with a delivery config as a delivery setup', async () => {
    expect(
      await present({
        status: 'enabled',
        webhookRegistration: { status: 'supported', purpose: 'delivery_setup' }
      })
    ).toEqual({
      status: 'enabled',
      webhook_registration: { status: 'supported', purpose: 'delivery_setup' }
    });
  });

  it('presents no purpose when webhook registration is unsupported', async () => {
    expect(
      await present({ status: 'enabled', webhookRegistration: { status: 'unsupported' } })
    ).toEqual({
      status: 'enabled',
      webhook_registration: { status: 'unsupported', purpose: null }
    });
    expect(await present({ status: 'enabled' })).toEqual({
      status: 'enabled',
      webhook_registration: { status: 'unsupported', purpose: null }
    });
    expect(await present({ status: 'disabled' })).toEqual({ status: 'disabled' });
  });
});
