import { eventually, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { enqueueSystemEvent, eventTrackerService, resolveSystemEventPayload } from '../src';

describe('module-event-tracker', () => {
  let org = useOrganization();

  it('ingests enqueued resource events with their presented payload', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    await enqueueSystemEvent({
      eventType: 'organization.created',
      organizationId: org.ids.organizationId,
      instanceId: org.ids.instanceId,
      payload: { organization: fixture.organization }
    });

    let event = await eventually(
      async () =>
        db.systemEvent.findFirstOrThrow({
          where: {
            organizationOid: fixture.organization.oid,
            eventType: 'organization.created'
          }
        }),
      { timeoutMs: 120_000, intervalMs: 1_000 }
    );
    expect(event).toMatchObject({ source: 'resource', instanceOid: fixture.instance.oid });

    let payload = await resolveSystemEventPayload(event);
    expect(payload).toMatchObject({ object: 'organization', id: org.ids.organizationId });
  }, 150_000);

  it('records callback and chat events idempotently', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let callbackEventId = uniqueId('e2e-callback-event');
    let chatEventId = uniqueId('e2e-chat-event');
    let callbackId = uniqueId('e2e-callback');
    let chatConnectionId = uniqueId('e2e-chat-connection');

    for (let i = 0; i < 2; i++) {
      await eventTrackerService.recordCallbackEvent({
        organizationOid: fixture.organization.oid,
        instanceOid: fixture.instance.oid,
        callbackEventId,
        callbackId,
        callbackTriggerKey: 'issue_created'
      });
      await eventTrackerService.recordChatEvent({
        organizationOid: fixture.organization.oid,
        instanceOid: fixture.instance.oid,
        chatEventId,
        chatConnectionId,
        eventType: 'chat.message.created'
      });
    }

    let callbackEvents = await db.systemEvent.findMany({ where: { callbackId } });
    expect(callbackEvents).toHaveLength(1);
    expect(callbackEvents[0]).toMatchObject({
      source: 'callback',
      eventType: 'callback.issue_created',
      callbackEventId,
      callbackTriggerKey: 'issue_created',
      organizationOid: fixture.organization.oid
    });

    let chatEvents = await db.systemEvent.findMany({ where: { chatConnectionId } });
    expect(chatEvents).toHaveLength(1);
    expect(chatEvents[0]).toMatchObject({
      source: 'chat',
      eventType: 'chat.message.created',
      chatEventId,
      instanceOid: fixture.instance.oid
    });
  });
});
