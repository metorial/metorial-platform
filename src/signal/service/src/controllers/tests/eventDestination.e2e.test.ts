import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, testDb } from '../../test/setup';
import { fixtures } from '../../test/fixtures';
import { createTestSignalClient, signalClient } from '../../test/client';
import { env } from '../../env';

describe('eventDestination.e2e', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('rotates one ordinary signing secret and preserves it across destination updates', async () => {
    let tenant = await f.tenant.default();
    let sender = await f.sender.default();
    let serviceCredential = 'subspace-service-test-credential';
    env.internal.SUBSPACE_SERVICE_CREDENTIAL = serviceCredential;
    let internalClient = createTestSignalClient({
      headers: { 'x-metorial-signal-service-credential': serviceCredential }
    });

    let created = await signalClient.eventDestination.create({
      tenantId: tenant.id,
      senderId: sender.id,
      name: 'Callback Webhook',
      eventTypes: null,
      variant: {
        type: 'http_endpoint',
        url: 'https://example.com/webhook',
        method: 'POST'
      }
    });
    expect(created.webhook).toMatchObject({ signingSecretConfigured: true });
    expect(created.webhook).not.toHaveProperty('signingSecret');

    let before = await testDb.eventDestination.findUniqueOrThrow({
      where: { id: created.id },
      include: { currentInstance: { include: { webhook: true } } }
    });
    let priorSecret = before.currentInstance!.webhook!.signingSecret;

    let rotated = await internalClient.eventDestination.rotateSigningSecret({
      tenantId: tenant.id,
      eventDestinationId: created.id
    });
    expect(Object.keys(rotated).sort()).toEqual([
      'eventDestinationId',
      'rotatedAt',
      'signingSecret'
    ]);
    expect(rotated.eventDestinationId).toBe(created.id);
    expect(rotated.signingSecret).toMatch(/^metorial_whsec_/);
    expect(rotated.signingSecret).not.toBe(priorSecret);

    let updated = await signalClient.eventDestination.update({
      tenantId: tenant.id,
      eventDestinationId: created.id,
      variant: {
        type: 'http_endpoint',
        url: 'https://example.com/webhook-v2',
        method: 'POST'
      }
    });
    expect(updated.webhook).toMatchObject({
      url: 'https://example.com/webhook-v2',
      signingSecretConfigured: true
    });
    expect(updated.webhook).not.toHaveProperty('signingSecret');

    let after = await testDb.eventDestination.findUniqueOrThrow({
      where: { id: created.id },
      include: { currentInstance: { include: { webhook: true } } }
    });
    expect(after.currentInstance!.webhook!.signingSecret).toBe(rotated.signingSecret);
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
