import { describe, expect, it } from 'vitest';
import { signal } from './client';
import { createSender, createTenant } from './fixtures';

describe('signal event destination', () => {
  it('creates, lists, updates, and deletes event destinations', async () => {
    let tenant = await createTenant();
    let sender = await createSender();

    let created = await signal.eventDestination.create({
      tenantId: tenant.id,
      senderId: sender.id,
      name: 'Primary Webhook',
      description: 'Main destination',
      eventTypes: null,
      retry: { type: 'linear', delaySeconds: 30, maxAttempts: 5 },
      variant: { type: 'http_endpoint', url: 'https://example.com/webhook', method: 'POST' }
    });

    expect(created).toMatchObject({
      name: 'Primary Webhook',
      eventTypes: null,
      webhook: { url: 'https://example.com/webhook' }
    });

    let fetched = await signal.eventDestination.get({
      tenantId: tenant.id,
      eventDestinationId: created.id
    });
    expect(fetched.id).toBe(created.id);

    let listed = await signal.eventDestination.list({ tenantId: tenant.id, limit: 10 });
    expect(listed.items).toHaveLength(1);

    let updated = await signal.eventDestination.update({
      tenantId: tenant.id,
      eventDestinationId: created.id,
      name: 'Updated Webhook',
      eventTypes: ['user.created']
    });
    expect(updated).toMatchObject({ name: 'Updated Webhook', eventTypes: ['user.created'] });

    await signal.eventDestination.delete({
      tenantId: tenant.id,
      eventDestinationId: created.id
    });

    let afterDelete = await signal.eventDestination.list({ tenantId: tenant.id, limit: 10 });
    expect(afterDelete.items).toHaveLength(0);
  });
});
