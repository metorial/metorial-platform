import { ID } from '@metorial/db';
import { eventually, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  dispatchSystemEventDelivery,
  eventDeliveryAttemptService,
  eventDeliveryService
} from '../src';

let createUnreachableDestination = async (fixture: OrganizationFixture) => {
  let webhookDestination = await db.webhookDestination.create({
    data: {
      id: await ID.generateId('webhookDestination'),
      url: `http://127.0.0.1/${uniqueId('hook')}`,
      method: 'POST',
      signingSecret: await ID.generateId('webhookSigningSecret'),
      organizationOid: fixture.organization.oid
    }
  });

  return db.eventDestination.create({
    data: {
      id: await ID.generateId('eventDestination'),
      name: uniqueId('destination'),
      status: 'active',
      type: 'webhook',
      retryMaxAttempts: 3,
      organizationOid: fixture.organization.oid,
      webhookDestinationOid: webhookDestination.oid
    }
  });
};

describe('module-event-delivery', () => {
  let org = useOrganization();

  it('pings a destination, records the failed attempt and retries it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let destination = await createUnreachableDestination(fixture);

    let ping = await eventDeliveryService.pingEventDestination({
      organization: fixture.organization,
      eventDestination: destination,
      auditScope: fixture.auditScope
    });
    expect(ping).toMatchObject({ status: 'pending', type: 'webhook', retryMaxAttempts: 3 });
    expect(ping.systemEvent).toMatchObject({ source: 'ping', eventType: 'ping' });

    let failed = await eventually(
      async () => {
        let delivery = await eventDeliveryService.getEventDeliveryById({
          organization: fixture.organization,
          eventDeliveryId: ping.id
        });
        expect(delivery.status).toBe('failed');
        return delivery;
      },
      { timeoutMs: 120_000, intervalMs: 1_000 }
    );
    expect(failed).toMatchObject({ attemptCount: 1, errorCode: 'url_not_allowed' });
    expect(failed.attempts).toHaveLength(1);

    let attempts = await firstPage(
      await eventDeliveryAttemptService.listEventDeliveryAttempts({
        organization: fixture.organization,
        eventDeliveryIds: [ping.id]
      })
    );
    expect(attempts.map(attempt => attempt.id)).toEqual([failed.attempts[0]!.id]);

    let attempt = await eventDeliveryAttemptService.getEventDeliveryAttemptById({
      organization: fixture.organization,
      eventDeliveryAttemptId: attempts[0]!.id
    });
    expect(attempt).toMatchObject({
      status: 'failed',
      attemptNumber: 1,
      isRetryable: false,
      errorCode: 'url_not_allowed'
    });
    expect(attempt.intent.eventDestination.id).toBe(destination.id);

    let retried = await eventDeliveryService.retryEventDelivery({
      organization: fixture.organization,
      eventDelivery: failed,
      auditScope: fixture.auditScope
    });
    expect(retried.status).toBe('retrying');

    await expect(
      eventDeliveryService.retryEventDelivery({
        organization: fixture.organization,
        eventDelivery: retried,
        auditScope: fixture.auditScope
      })
    ).rejects.toThrow();

    let retriedFailed = await eventually(
      async () => {
        let delivery = await eventDeliveryService.getEventDeliveryById({
          organization: fixture.organization,
          eventDeliveryId: ping.id
        });
        expect(delivery).toMatchObject({ status: 'failed', attemptCount: 2 });
        return delivery;
      },
      { timeoutMs: 120_000, intervalMs: 1_000 }
    );
    expect(retriedFailed.attempts.map(attempt => attempt.attemptNumber)).toEqual([1, 2]);
  }, 300_000);

  it('dispatches a system event to the destinations whose listeners match it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let matching = await createUnreachableDestination(fixture);
    let other = await createUnreachableDestination(fixture);

    await db.eventDestinationListener.create({
      data: {
        id: await ID.generateId('eventDestinationListener'),
        type: 'event',
        eventTypes: ['organization.created'],
        instanceOid: fixture.instance.oid,
        eventDestinationOid: matching.oid
      }
    });
    await db.eventDestinationListener.create({
      data: {
        id: await ID.generateId('eventDestinationListener'),
        type: 'event',
        eventTypes: [uniqueId('e2e.other')],
        instanceOid: fixture.instance.oid,
        eventDestinationOid: other.oid
      }
    });

    let systemEvent = await db.systemEvent.create({
      data: {
        id: await ID.generateId('systemEvent'),
        source: 'resource',
        eventType: 'organization.created',
        organizationOid: fixture.organization.oid,
        instanceOid: fixture.instance.oid,
        payloadJson: { object: 'organization', id: org.ids.organizationId }
      }
    });

    await dispatchSystemEventDelivery({ systemEventId: systemEvent.id });

    let deliveries = await eventually(
      async () => {
        let items = await firstPage(
          await eventDeliveryService.listEventDeliveries({
            organization: fixture.organization,
            eventIds: [systemEvent.id]
          })
        );
        expect(items).toHaveLength(1);
        return items;
      },
      { timeoutMs: 120_000, intervalMs: 1_000 }
    );
    expect(deliveries[0]!.eventDestination.id).toBe(matching.id);
    expect(deliveries[0]!.instance?.id).toBe(org.ids.instanceId);

    let byDestination = await firstPage(
      await eventDeliveryService.listEventDeliveries({
        organization: fixture.organization,
        eventDestinationIds: [other.id]
      })
    );
    expect(byDestination).toHaveLength(0);
  }, 180_000);
});
