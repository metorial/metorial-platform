import { ID } from '@metorial/db';
import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { eventLogService } from '../src';

describe('module-event-log', () => {
  let org = useOrganization();

  it('exposes the declared webhook event types', async () => {
    let events = await eventLogService.getWebhookEvents();
    expect(events.map(event => event.name)).toContain('organization.created');
  });

  it('lists and gets system events of an organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let eventType = uniqueId('e2e.event');

    let organizationEvent = await db.systemEvent.create({
      data: {
        id: await ID.generateId('systemEvent'),
        source: 'resource',
        eventType,
        organizationOid: fixture.organization.oid,
        instanceOid: null,
        payloadJson: { scope: 'organization' }
      }
    });
    let instanceEvent = await db.systemEvent.create({
      data: {
        id: await ID.generateId('systemEvent'),
        source: 'resource',
        eventType,
        organizationOid: fixture.organization.oid,
        instanceOid: fixture.instance.oid,
        payloadJson: { scope: 'instance' }
      }
    });

    let events = await firstPage(
      await eventLogService.listEvents({
        organization: fixture.organization,
        eventTypes: [eventType]
      })
    );
    expect(events.map(event => event.id).sort()).toEqual(
      [organizationEvent.id, instanceEvent.id].sort()
    );

    let instanceScoped = await firstPage(
      await eventLogService.listEvents({
        organization: fixture.organization,
        instanceId: org.ids.instanceId,
        eventTypes: [eventType],
        sources: ['resource']
      })
    );
    expect(instanceScoped).toHaveLength(2);

    let pingOnly = await firstPage(
      await eventLogService.listEvents({
        organization: fixture.organization,
        eventTypes: [eventType],
        sources: ['ping']
      })
    );
    expect(pingOnly).toHaveLength(0);

    let event = await eventLogService.getEventById({
      organization: fixture.organization,
      eventId: instanceEvent.id
    });
    expect(event).toMatchObject({
      id: instanceEvent.id,
      eventType,
      payloadJson: { scope: 'instance' },
      chatPayload: null,
      callbackPayload: null
    });
    expect(event.instance?.id).toBe(org.ids.instanceId);
  });

  it('rejects unknown events and instances', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    await expect(
      eventLogService.getEventById({
        organization: fixture.organization,
        eventId: 'sev_does_not_exist'
      })
    ).rejects.toThrow();

    await expect(
      eventLogService.listEvents({
        organization: fixture.organization,
        instanceId: 'ins_does_not_exist'
      })
    ).rejects.toThrow();
  });
});
