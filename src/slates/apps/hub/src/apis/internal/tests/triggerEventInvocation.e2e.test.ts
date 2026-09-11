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

    return { registration, registrationInstance };
  };

  let makeWebhookEvent = async () => {
    let secret = await f.secret.default({
      tenantOid: tenant.oid,
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
        tenantOid: tenant.oid,
        slateOid: slate.oid,
        triggerGroupOid: triggerGroup.oid,
        secretOid: secret.oid
      }
    });

    return testDb.slateWebhookEvent.create({
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

  let provider = await f.deploymentProvider.default();
  let deployment = await f.slateDeployment.default({
    slateOid: slate.oid,
    slateVersionOid: slate.currentVersion.oid,
    providerOid: provider.oid,
    overrides: { status: 'succeeded' }
  });

  let makeInvocation = async () =>
    f.slateInvocation.succeeded({ deploymentOid: deployment.oid });

  let makeMapInvocation = async (d: { triggerEventOid: bigint; attempt?: number }) => {
    let invocation = await makeInvocation();

    return testDb.triggerEventInvocation.create({
      data: {
        ...getId('triggerEventInvocation'),
        status: 'succeeded',
        attempt: d.attempt ?? 1,
        triggerEventOid: d.triggerEventOid,
        invocationOid: invocation.oid
      }
    });
  };

  let makeWebhookHandleInvocation = async (d: {
    webhookEventOid: bigint;
    attempt?: number;
    error?: { code: string; message: string };
  }) => {
    let invocation = await makeInvocation();

    return testDb.slateWebhookEventInvocation.create({
      data: {
        ...getId('slateWebhookEventInvocation'),
        status: d.error ? 'failed' : 'succeeded',
        attempt: d.attempt ?? 1,
        webhookEventOid: d.webhookEventOid,
        invocationOid: invocation.oid,
        errorCode: d.error?.code,
        errorMessage: d.error?.message
      }
    });
  };

  return {
    tenant,
    slate,
    makeCallback,
    makeEvent,
    makeWebhookEvent,
    makeMapInvocation,
    makeWebhookHandleInvocation
  };
};

describe('triggerEventInvocation:getMany E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns the mapping invocations for a trigger event', async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();
    let event = await s.makeEvent({ registrationInstanceOid: registrationInstance.oid });
    let mapInvocation = await s.makeMapInvocation({ triggerEventOid: event.oid });

    let result = await slatesHubClient.triggerEventInvocation.getMany({
      tenantId: s.tenant.id,
      triggerEventIds: [event.id]
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      object: 'trigger_event.invocation',
      id: mapInvocation.id,
      type: 'map_event',
      status: 'succeeded',
      attempt: 1,
      triggerEventIds: [event.id],
      webhookEventId: null,
      error: null
    });
    expect(result[0]!.invocation.id).toBeTruthy();
  });

  it('includes the webhook handling invocations that carried the event', async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();
    let webhookEvent = await s.makeWebhookEvent();
    let event = await s.makeEvent({
      registrationInstanceOid: registrationInstance.oid,
      webhookEventOid: webhookEvent.oid
    });

    await s.makeMapInvocation({ triggerEventOid: event.oid });
    let handleInvocation = await s.makeWebhookHandleInvocation({
      webhookEventOid: webhookEvent.oid
    });

    let result = await slatesHubClient.triggerEventInvocation.getMany({
      tenantId: s.tenant.id,
      triggerEventIds: [event.id]
    });

    expect(result).toHaveLength(2);

    let handle = result.find(i => i.id === handleInvocation.id);
    expect(handle).toMatchObject({
      type: 'webhook_handle',
      triggerEventIds: [event.id],
      webhookEventId: webhookEvent.id
    });
  });

  it('reports a shared webhook invocation once, against every requested event', async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();
    let webhookEvent = await s.makeWebhookEvent();

    let first = await s.makeEvent({
      registrationInstanceOid: registrationInstance.oid,
      triggerId: 'message.created',
      webhookEventOid: webhookEvent.oid
    });
    let second = await s.makeEvent({
      registrationInstanceOid: registrationInstance.oid,
      triggerId: 'message.updated',
      webhookEventOid: webhookEvent.oid
    });

    let handleInvocation = await s.makeWebhookHandleInvocation({
      webhookEventOid: webhookEvent.oid
    });

    let result = await slatesHubClient.triggerEventInvocation.getMany({
      tenantId: s.tenant.id,
      triggerEventIds: [first.id, second.id]
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(handleInvocation.id);
    expect(result[0]!.triggerEventIds.sort()).toEqual([first.id, second.id].sort());
  });

  it('surfaces the failure of a webhook handling invocation', async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();
    let webhookEvent = await s.makeWebhookEvent();
    let event = await s.makeEvent({
      registrationInstanceOid: registrationInstance.oid,
      webhookEventOid: webhookEvent.oid
    });

    await s.makeWebhookHandleInvocation({
      webhookEventOid: webhookEvent.oid,
      error: { code: 'slate_error', message: 'the slate blew up' }
    });

    let result = await slatesHubClient.triggerEventInvocation.getMany({
      tenantId: s.tenant.id,
      triggerEventIds: [event.id]
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      status: 'failed',
      error: { code: 'slate_error', message: 'the slate blew up' }
    });
  });

  it("does not return invocations for another tenant's trigger events", async () => {
    let s = await scenario();
    let { registrationInstance } = await s.makeCallback();
    let event = await s.makeEvent({ registrationInstanceOid: registrationInstance.oid });
    await s.makeMapInvocation({ triggerEventOid: event.oid });

    let otherTenant = await f.tenant.default();

    let result = await slatesHubClient.triggerEventInvocation.getMany({
      tenantId: otherTenant.id,
      triggerEventIds: [event.id]
    });

    expect(result).toEqual([]);
  });

  it('returns nothing for an empty id list', async () => {
    let s = await scenario();

    let result = await slatesHubClient.triggerEventInvocation.getMany({
      tenantId: s.tenant.id,
      triggerEventIds: []
    });

    expect(result).toEqual([]);
  });
});
