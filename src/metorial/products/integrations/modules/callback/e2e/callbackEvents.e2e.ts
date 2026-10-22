import { createHmac } from 'node:crypto';
import { ID } from '@metorial/db';
import {
  createRemoteProvider,
  eventually,
  expectOk,
  expectServiceError,
  firstPage,
  uniqueId,
  useFixture,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { db, type OrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callbackEventInternalService, callbackEventService } from '../src';
import {
  createIntegrationInstance,
  createIntegrationProvider,
  enableProviderTriggers,
  findActiveCallbacks,
  provisionCallbackInstance,
  scopeOf,
  waitForCallbackSync
} from './_fixtures';

let ids = (items: { id: string }[]) => items.map(item => item.id);

let headerValue = (headers: { key: string; value: string }[], key: string) =>
  headers.find(header => header.key === key)?.value;

describe('module-callback callback events', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let server = useMcpTestServer();

  let received: { path: string; headers: Record<string, string>; body: string }[] = [];
  let receiver: ReturnType<typeof Bun.serve> | undefined;
  beforeAll(() => {
    receiver = Bun.serve({
      port: 0,
      hostname: '0.0.0.0',
      fetch: async request => {
        received.push({
          path: new URL(request.url).pathname,
          headers: Object.fromEntries(request.headers),
          body: await request.text()
        });
        return new Response('ok');
      }
    });
  });
  afterAll(async () => {
    await receiver?.stop(true);
  });

  let setup = useFixture(async () => {
    let remote = await createRemoteProvider(org.clients.instance, { url: server.url });
    await enableProviderTriggers(remote.providerId);

    let created = await createIntegrationProvider(org, {
      providerId: remote.providerId,
      callbacks: true
    });
    let integrationProvider = expectOk(created.response);
    let [callback] = await findActiveCallbacks(integrationProvider.id);

    let { integrationInstanceProvider } = await createIntegrationInstance(org, {
      integrationId: created.integration.id,
      providerId: remote.providerId
    });
    await waitForCallbackSync(callback!.id);
    let callbackInstance = await provisionCallbackInstance({
      callbackId: callback!.id,
      integrationInstanceProviderId: integrationInstanceProvider.id
    });

    return {
      providerId: remote.providerId,
      integration: created.integration,
      integrationProvider,
      callback: callback!,
      callbackInstance
    };
  });

  let recordEvent = async (input: {
    providerTriggerKey: string;
    source?: 'webhook' | 'polling' | 'internal';
    occurredAt?: Date;
  }) => {
    let event = await callbackEventInternalService.recordEvent({
      callbackInstance: setup.callbackInstance,
      source: input.source ?? 'webhook',
      providerTriggerKey: input.providerTriggerKey,
      mappedType: 'issue',
      mappedId: uniqueId('issue'),
      occurredAt: input.occurredAt ?? new Date()
    });
    expect(event).not.toBeNull();
    return event!;
  };

  let waitForSystemEvent = (callbackEventId: string) =>
    eventually(
      async () => {
        let systemEvent = await db.systemEvent.findUnique({ where: { callbackEventId } });
        if (!systemEvent) throw new Error(`No system event for ${callbackEventId} yet`);
        return systemEvent;
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );

  let createDestination = async (fixture: OrganizationFixture, name: string) => {
    let webhookDestination = await db.webhookDestination.create({
      data: {
        id: await ID.generateId('webhookDestination'),
        url: `http://localhost:${receiver!.port}/hooks/${name}`,
        method: 'POST',
        signingSecret: await ID.generateId('webhookSigningSecret'),
        organizationOid: fixture.organization.oid
      }
    });

    return await db.eventDestination.create({
      data: {
        id: await ID.generateId('eventDestination'),
        name: uniqueId(name),
        status: 'active',
        type: 'webhook',
        retryStrategy: 'fixed',
        retryMaxAttempts: 2,
        retryBaseDelaySeconds: 1,
        retryMaxDelaySeconds: 1,
        organizationOid: fixture.organization.oid,
        webhookDestinationOid: webhookDestination.oid
      },
      include: { webhookDestination: true }
    });
  };

  let listen = async (
    fixture: OrganizationFixture,
    destination: { oid: bigint },
    input: {
      type?: 'callback' | 'event';
      callbackId?: string;
      providerId?: string;
      triggers?: string[];
      eventTypes?: string[];
    }
  ) =>
    await db.eventDestinationListener.create({
      data: {
        id: await ID.generateId('eventDestinationListener'),
        type: input.type ?? 'callback',
        eventTypes: input.eventTypes ?? [],
        callbackId: input.callbackId,
        providerId: input.providerId,
        triggers: input.triggers ?? [],
        instanceOid: fixture.instance.oid,
        eventDestinationOid: destination.oid
      }
    });

  it('records a provider event as a pending callback event and a callback system event', async () => {
    let scope = await scopeOf(org);
    let occurredAt = new Date(Date.now() - 60_000);
    let event = await recordEvent({ providerTriggerKey: 'issue.created', occurredAt });

    expect(event).toMatchObject({
      status: 'pending',
      source: 'webhook',
      providerTriggerKey: 'issue.created',
      providerTriggerOid: null,
      mappedType: 'issue',
      callbackOid: setup.callback.oid,
      callbackInstanceOid: setup.callbackInstance.oid,
      tenantOid: scope.tenant.oid,
      occurredAt,
      readAt: null
    });

    let systemEvent = await waitForSystemEvent(event.id);
    expect(systemEvent).toMatchObject({
      source: 'callback',
      eventType: 'callback.issue.created',
      callbackId: setup.callback.id,
      callbackTriggerKey: 'issue.created',
      providerId: setup.providerId,
      organizationOid: scope.fixture.organization.oid,
      instanceOid: scope.fixture.instance.oid
    });
  });

  it('delivers a callback event only to matching listeners, signs it and retries refused deliveries', async () => {
    let scope = await scopeOf(org);
    let fixture = scope.fixture;

    let byCallback = await createDestination(fixture, 'by-callback');
    await listen(fixture, byCallback, { callbackId: setup.callback.id });
    let byTrigger = await createDestination(fixture, 'by-trigger');
    await listen(fixture, byTrigger, {
      providerId: setup.providerId,
      triggers: ['issue.updated']
    });
    let otherTrigger = await createDestination(fixture, 'other-trigger');
    await listen(fixture, otherTrigger, {
      callbackId: setup.callback.id,
      triggers: ['issue.closed']
    });
    let otherCallback = await createDestination(fixture, 'other-callback');
    await listen(fixture, otherCallback, { callbackId: uniqueId('missing-callback') });
    let eventListener = await createDestination(fixture, 'event-listener');
    await listen(fixture, eventListener, {
      type: 'event',
      eventTypes: ['callback.issue.updated']
    });

    let event = await recordEvent({ providerTriggerKey: 'issue.updated' });
    let systemEvent = await waitForSystemEvent(event.id);

    let intents = await eventually(
      async () => {
        let intents = await db.eventDeliveryIntent.findMany({
          where: { systemEventOid: systemEvent.oid },
          include: {
            eventDestination: { include: { webhookDestination: true } },
            attempts: { orderBy: { attemptNumber: 'asc' } }
          }
        });
        expect(intents.map(intent => intent.eventDestination.id).sort()).toEqual(
          [byCallback.id, byTrigger.id].sort()
        );
        for (let intent of intents) {
          expect(intent).toMatchObject({ status: 'failed', attemptCount: 2 });
        }
        return intents;
      },
      { timeoutMs: 120_000, intervalMs: 1_000 }
    );

    for (let intent of intents) {
      expect(intent.errorCode).toBe('request_failed');
      expect(intent.attempts.map(attempt => attempt.attemptNumber)).toEqual([1, 2]);

      for (let attempt of intent.attempts) {
        expect(attempt).toMatchObject({
          status: 'failed',
          isRetryable: true,
          errorCode: 'request_failed',
          responseStatusCode: null
        });

        let request = (attempt.detailsJson as any).request as {
          url: string;
          method: string;
          headers: { key: string; value: string }[];
          body: string;
        };
        expect(request.url).toBe(intent.eventDestination.webhookDestination!.url);
        expect(request.method).toBe('POST');
        expect(headerValue(request.headers, 'metorial-event-id')).toBe(systemEvent.id);
        expect(headerValue(request.headers, 'metorial-event-type')).toBe(
          'callback.issue.updated'
        );
        expect(headerValue(request.headers, 'metorial-delivery-id')).toBe(intent.id);
        expect(headerValue(request.headers, 'metorial-delivery-attempt')).toBe(
          String(attempt.attemptNumber)
        );
        expect(headerValue(request.headers, 'metorial-destination-id')).toBe(
          intent.eventDestination.id
        );

        let timestamp = headerValue(request.headers, 'metorial-timestamp')!;
        let expected = createHmac(
          'sha256',
          intent.eventDestination.webhookDestination!.signingSecret
        )
          .update(`${timestamp}.${request.body}`)
          .digest('hex');
        expect(headerValue(request.headers, 'metorial-signature')).toBe(
          `t=${timestamp},v1=${expected}`
        );

        expect(JSON.parse(request.body)).toEqual({
          object: 'event',
          id: systemEvent.id,
          source: 'callback',
          event_type: 'callback.issue.updated',
          compartments: [
            {
              type: 'instance',
              organization_id: fixture.organization.id,
              instance_id: fixture.instance.id
            }
          ],
          callback_id: setup.callback.id,
          callback_trigger_key: 'issue.updated',
          chat_event_id: null,
          chat_connection_id: null,
          occurred_at: systemEvent.createdAt.toISOString(),
          payload: null
        });
      }
    }

    expect(received).toEqual([]);
  }, 180_000);

  it('lists, reads and marks callback events as read', async () => {
    let scope = await scopeOf(org);
    let webhookKey = `issue.${uniqueId('opened')}`;
    let pollingKey = `issue.${uniqueId('polled')}`;
    let webhookEvent = await recordEvent({
      providerTriggerKey: webhookKey,
      occurredAt: new Date(Date.now() - 120_000)
    });
    let pollingEvent = await recordEvent({
      providerTriggerKey: pollingKey,
      source: 'polling'
    });

    let list = async (
      input: Omit<Parameters<typeof callbackEventService.listCallbackEvents>[0], 'instance'>
    ) =>
      ids(
        await firstPage(
          await callbackEventService.listCallbackEvents({ instance: scope.instance, ...input })
        )
      );
    let ours = [webhookEvent.id, pollingEvent.id];

    expect(await list({ callbackIds: [setup.callback.id] })).toEqual(
      expect.arrayContaining(ours)
    );
    expect(await list({ callbackInstanceIds: [setup.callbackInstance.id] })).toEqual(
      expect.arrayContaining(ours)
    );
    expect(await list({ integrationIds: [setup.integration.id] })).toEqual(
      expect.arrayContaining(ours)
    );
    expect(await list({ integrationProviderIds: [setup.integrationProvider.id] })).toEqual(
      expect.arrayContaining(ours)
    );
    expect(await list({ providerIds: [setup.providerId] })).toEqual(
      expect.arrayContaining(ours)
    );
    expect(await list({ providerTriggerKeys: [webhookKey] })).toEqual([webhookEvent.id]);
    expect(await list({ providerTriggerKeys: [webhookKey], source: ['polling'] })).toEqual([]);
    expect(await list({ callbackIds: [setup.callback.id], source: ['polling'] })).toEqual([
      pollingEvent.id
    ]);
    expect(await list({ providerTriggerKeys: [pollingKey], status: ['pending'] })).toEqual([
      pollingEvent.id
    ]);
    expect(await list({ providerTriggerKeys: [pollingKey], status: ['failed'] })).toEqual([]);
    expect(
      await list({
        providerTriggerKeys: [webhookKey, pollingKey],
        occurredAt: { gt: new Date(Date.now() - 60_000) }
      })
    ).toEqual([pollingEvent.id]);
    expect(await list({ integrationProviderIds: [uniqueId('missing')] })).toEqual([]);

    let fetched = await callbackEventService.getCallbackEventById({
      instance: scope.instance,
      callbackEventId: webhookEvent.id
    });
    expect(fetched).toMatchObject({
      id: webhookEvent.id,
      providerTriggerKey: webhookKey,
      details: null,
      callback: expect.objectContaining({ id: setup.callback.id }),
      callbackInstance: expect.objectContaining({ id: setup.callbackInstance.id })
    });

    let marked = await callbackEventService.markCallbackEventsReadInternal({
      tenant: scope.tenant,
      environment: scope.environment,
      callbackEventIds: [webhookEvent.id]
    });
    expect(marked.markedIds).toEqual([webhookEvent.id]);
    expect(
      (
        await callbackEventService.markCallbackEventsReadInternal({
          tenant: scope.tenant,
          environment: scope.environment,
          callbackEventIds: [webhookEvent.id]
        })
      ).markedIds
    ).toEqual([]);
    expect(
      (
        await callbackEventService.markCallbackEventsReadInternal({
          tenant: scope.tenant,
          environment: scope.environment,
          callbackEventIds: [pollingEvent.id],
          integrationProviderIds: [uniqueId('missing')]
        })
      ).markedIds
    ).toEqual([]);

    let unread = await list({ providerTriggerKeys: [webhookKey, pollingKey], unread: true });
    expect(unread).toEqual([pollingEvent.id]);
    expect(
      (await subspaceDb.callbackEvent.findUniqueOrThrow({ where: { id: webhookEvent.id } }))
        .readAt
    ).toBeInstanceOf(Date);
  });

  it('hides callback events from other organizations', async () => {
    let event = await recordEvent({ providerTriggerKey: `issue.${uniqueId('private')}` });
    let other = await scopeOf(otherOrg);

    await expectServiceError(
      callbackEventService.getCallbackEventById({
        instance: other.instance,
        callbackEventId: event.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await callbackEventService.listCallbackEvents({
          instance: other.instance,
          callbackIds: [setup.callback.id]
        })
      )
    ).toEqual([]);
    expect(
      ids(
        await firstPage(
          await callbackEventService.listCallbackEvents({ instance: other.instance })
        )
      )
    ).not.toContain(event.id);

    let marked = await callbackEventService.markCallbackEventsReadInternal({
      tenant: other.tenant,
      environment: other.environment,
      callbackEventIds: [event.id]
    });
    expect(marked.markedIds).toEqual([]);
    expect(
      (await subspaceDb.callbackEvent.findUniqueOrThrow({ where: { id: event.id } })).readAt
    ).toBeNull();
  });
});
