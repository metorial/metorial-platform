import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, testDb } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { signalClient } from '../../test/client';

describe('eventDestination.e2e', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates, lists, updates, and deletes event destinations', async () => {
    const tenant = await f.tenant.default();
    const sender = await f.sender.default();

    const created = await signalClient.eventDestination.create({
      tenantId: tenant.id,
      senderId: sender.id,
      name: 'Primary Webhook',
      description: 'Main destination',
      eventTypes: null,
      retry: {
        type: 'linear',
        delaySeconds: 30,
        maxAttempts: 5
      },
      variant: {
        type: 'http_endpoint',
        url: 'https://example.com/webhook',
        method: 'POST'
      }
    });

    expect(created).toMatchObject({
      name: 'Primary Webhook',
      eventTypes: null,
      webhook: { url: 'https://example.com/webhook' }
    });

    const fetched = await signalClient.eventDestination.get({
      tenantId: tenant.id,
      eventDestinationId: created.id
    });
    expect(fetched.id).toBe(created.id);

    const listed = await signalClient.eventDestination.list({
      tenantId: tenant.id,
      limit: 10
    });
    expect(listed.items).toHaveLength(1);

    const updated = await signalClient.eventDestination.update({
      tenantId: tenant.id,
      eventDestinationId: created.id,
      name: 'Updated Webhook',
      eventTypes: ['user.created']
    });

    expect(updated).toMatchObject({
      name: 'Updated Webhook',
      eventTypes: ['user.created']
    });

    await signalClient.eventDestination.delete({
      tenantId: tenant.id,
      eventDestinationId: created.id
    });

    const afterDelete = await signalClient.eventDestination.list({
      tenantId: tenant.id,
      limit: 10
    });
    expect(afterDelete.items).toHaveLength(0);
  });
});
