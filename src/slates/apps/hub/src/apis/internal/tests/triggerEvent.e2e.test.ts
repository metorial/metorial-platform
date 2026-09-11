import { beforeEach, describe, expect, it } from 'vitest';
import { getId } from '../../../id';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

let f = fixtures(testDb);

let scenario = async () => {
  let tenant = await f.tenant.default();
  let slate = await f.slate.complete();
  let specification = slate.currentVersion.specification;

  let triggerGroup = await testDb.slateTriggerGroup.create({
    data: {
      ...getId('slateTriggerGroup'),
      identifier: `tg-${crypto.randomUUID()}`,
      hash: 'hash',
      key: 'messages',
      name: 'Messages',
      spec: {
        id: 'messages',
        name: 'Messages',
        invocation: { type: 'webhook', registration: { mode: 'manual' } }
      } as any,
      slateOid: slate.oid,
      mostRecentSpecificationOid: specification.oid
    }
  });

  let configSchema = await f.slateConfigSchema.default({
    slateOid: slate.oid,
    specificationOid: specification.oid
  });

  let makeCallback = async () => {
    let slateInstance = await testDb.slateInstance.create({
      data: { ...getId('slateInstance'), slateOid: slate.oid, tenantOid: tenant.oid }
    });
    let instanceConfig = await f.slateInstanceConfig.default({
      instanceOid: slateInstance.oid,
      schemaOid: configSchema.oid,
      tenantOid: tenant.oid
    });

    let registration = await testDb.triggerRegistration.create({
      data: {
        ...getId('triggerRegistration'),
        tenantOid: tenant.oid,
        slateOid: slate.oid,
        instanceOid: slateInstance.oid,
        instanceConfigOid: instanceConfig.oid
      }
    });

    let registrationInstance = await testDb.triggerRegistrationInstance.create({
      data: {
        ...getId('triggerRegistrationInstance'),
        triggerRegistrationOid: registration.oid,
        triggerGroupOid: triggerGroup.oid
      }
    });

    let callback = await testDb.callback.create({
      data: {
        ...getId('callback'),
        tenantOid: tenant.oid,
        slateOid: slate.oid,
        name: 'Test callback'
      }
    });

    let callbackInstance = await testDb.callbackInstance.create({
      data: {
        ...getId('callbackInstance'),
        tenantOid: tenant.oid,
        callbackOid: callback.oid,
        triggerRegistrationOid: registration.oid
      }
    });

    return { registration, registrationInstance, callback, callbackInstance };
  };

  let makeEvent = async (d: {
    registrationInstanceOid: bigint;
    triggerId?: string;
    webhookEventOid?: bigint;
  }) => {
    let triggerId = d.triggerId ?? 'message.created';

    let rawEvent = await testDb.triggerRawEvent.create({
      data: {
        ...getId('triggerRawEvent'),
        source: 'webhook',
        triggerRegistrationInstanceOid: d.registrationInstanceOid,
        webhookEventOid: d.webhookEventOid ?? null,
        payload: { hello: 'world' },
        triggerIds: [triggerId],
        pendingTriggerMapCount: 1
      }
    });

    return testDb.triggerEvent.create({
      data: {
        ...getId('triggerEvent'),
        status: 'mapped',
        source: 'webhook',
        triggerRegistrationInstanceOid: d.registrationInstanceOid,
        rawEventOid: rawEvent.oid,
        webhookEventOid: d.webhookEventOid ?? null,
        triggerId,
        payload: { hello: 'world' },
        mappedType: 'message',
        mappedId: 'msg_1'
      }
    });
  };

  return { tenant, slate, triggerGroup, makeCallback, makeEvent };
};

describe('triggerEvent:list E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns trigger events for a tenant', async () => {
    let s = await scenario();
    let { registration, registrationInstance, callbackInstance } = await s.makeCallback();
    let event = await s.makeEvent({ registrationInstanceOid: registrationInstance.oid });

    let result = await slatesHubClient.triggerEvent.list({
      tenantId: s.tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: event.id,
      status: 'mapped',
      source: 'webhook',
      triggerId: 'message.created',
      triggerGroupId: s.triggerGroup.id,
      triggerRegistrationId: registration.id,
      triggerRegistrationInstanceId: registrationInstance.id,
      callbackInstanceId: callbackInstance.id,
      mappedType: 'message',
      mappedId: 'msg_1',
      webhookEventId: null
    });
  });

  it('filters by callbackIds', async () => {
    let s = await scenario();
    let first = await s.makeCallback();
    let second = await s.makeCallback();

    let event = await s.makeEvent({
      registrationInstanceOid: first.registrationInstance.oid
    });
    await s.makeEvent({ registrationInstanceOid: second.registrationInstance.oid });

    let result = await slatesHubClient.triggerEvent.list({
      tenantId: s.tenant.id,
      callbackIds: [first.callback.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(event.id);
  });

  it('filters by triggerRegistrationIds', async () => {
    let s = await scenario();
    let first = await s.makeCallback();
    let second = await s.makeCallback();

    await s.makeEvent({ registrationInstanceOid: first.registrationInstance.oid });
    let event = await s.makeEvent({
      registrationInstanceOid: second.registrationInstance.oid
    });

    let result = await slatesHubClient.triggerEvent.list({
      tenantId: s.tenant.id,
      triggerRegistrationIds: [second.registration.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(event.id);
  });
});

describe('triggerEvent:get E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single trigger event by ID', async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();
    let event = await s.makeEvent({ registrationInstanceOid: registrationInstance.oid });

    let result = await slatesHubClient.triggerEvent.get({
      tenantId: s.tenant.id,
      triggerEventId: event.id
    });

    expect(result).toMatchObject({
      id: event.id,
      payload: { hello: 'world' }
    });
    expect(result).not.toHaveProperty('rawEventId');
  });

  it('keeps exposing the webhook event id after the raw event is cleaned up', async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();

    let secret = await f.secret.default({
      tenantOid: s.tenant.oid,
      type: 'slate_webhook_registration_payload'
    });

    let webhookRegistration = await testDb.slateWebhookRegistration.create({
      data: {
        ...getId('slateWebhookRegistration'),
        type: 'manual',
        owner: 'tenant',
        status: 'active',
        urlKey: crypto.randomUUID(),
        name: 'Test webhook',
        tenantOid: s.tenant.oid,
        slateOid: s.slate.oid,
        triggerGroupOid: s.triggerGroup.oid,
        secretOid: secret.oid
      }
    });

    let webhookEvent = await testDb.slateWebhookEvent.create({
      data: {
        ...getId('slateWebhookEvent'),
        status: 'succeeded',
        attemptCount: 1,
        webhookRegistrationOid: webhookRegistration.oid,
        request: {
          method: 'POST',
          url: 'https://webhooks.test/receive/whk_test',
          headers: { 'content-type': 'application/json' },
          body: { encoding: 'base64', content: 'e30=' }
        }
      }
    });

    let event = await s.makeEvent({
      registrationInstanceOid: registrationInstance.oid,
      webhookEventOid: webhookEvent.oid
    });

    // Simulate the raw event cleanup that happens once all trigger events map successfully.
    await testDb.triggerRawEvent.deleteMany({});

    let result = await slatesHubClient.triggerEvent.get({
      tenantId: s.tenant.id,
      triggerEventId: event.id
    });

    expect(result).toMatchObject({ webhookEventId: webhookEvent.id });
  });

  it('does not return events of another tenant', async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();
    let event = await s.makeEvent({ registrationInstanceOid: registrationInstance.oid });

    let otherTenant = await f.tenant.default();

    await expect(
      slatesHubClient.triggerEvent.get({
        tenantId: otherTenant.id,
        triggerEventId: event.id
      })
    ).rejects.toThrow();
  });
});

describe('triggerEvent:getMany E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple trigger events by IDs', async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();

    let first = await s.makeEvent({
      registrationInstanceOid: registrationInstance.oid,
      triggerId: 'message.created'
    });
    let second = await s.makeEvent({
      registrationInstanceOid: registrationInstance.oid,
      triggerId: 'message.updated'
    });

    let result = await slatesHubClient.triggerEvent.getMany({
      tenantId: s.tenant.id,
      triggerEventIds: [first.id, second.id]
    });

    expect(result.map(e => e.id).sort()).toEqual([first.id, second.id].sort());
  });
});
