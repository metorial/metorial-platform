import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial-subspace/db', () => ({ getOAuthCallbackUrl: async () => null }));
vi.mock('@metorial/db', () => ({}));

import { v1WebhookRegistrationPresenter } from './webhookRegistration';

let createWebhookRegistration = (
  purpose: 'webhook_receiver' | 'delivery_setup',
  authCredentials: { id: string } | null
) =>
  ({
    id: 'whr_1',
    status: 'active',
    purpose,
    name: 'Gmail Delivery Setup',
    description: null,
    metadata: null,
    receiveUrl: 'https://triggers.metorial.com/w/whk_1',
    setup: { document: 'Do this.', schema: null },
    provider: {
      id: 'pro_1',
      name: 'Gmail',
      description: null,
      slug: 'gmail',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z')
    },
    authCredentials,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
  }) as any;

let present = (webhookRegistration: any) =>
  v1WebhookRegistrationPresenter
    .present(
      { webhookRegistration },
      { apiVersion: 'mt_2026_01_01_magnetar', accessType: 'user_auth_token' }
    )
    .run();

describe('webhook registration presentation', () => {
  it('presents a delivery setup with the credentials it is for', async () => {
    let presented = await present(
      createWebhookRegistration('delivery_setup', { id: 'par_1' })
    );

    expect(presented.purpose).toBe('delivery_setup');
    expect(presented.auth_credentials_id).toBe('par_1');
  });

  it('presents a webhook receiver without credentials', async () => {
    let presented = await present(createWebhookRegistration('webhook_receiver', null));

    expect(presented.purpose).toBe('webhook_receiver');
    expect(presented.auth_credentials_id).toBeNull();
  });
});
