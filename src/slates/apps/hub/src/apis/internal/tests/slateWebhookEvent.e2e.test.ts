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

  let makeRegistration = async (d?: { owner?: 'tenant' | 'global' }) => {
    let owner = d?.owner ?? 'tenant';
    let secret = await f.secret.default({
      tenantOid: tenant.oid,
      type: 'slate_webhook_registration_payload'
    });

    return testDb.slateWebhookRegistration.create({
      data: {
        ...getId('slateWebhookRegistration'),
        type: 'manual',
        owner,
        status: 'active',
        urlKey: crypto.randomUUID(),
        name: 'Test webhook',
        tenantOid: owner === 'tenant' ? tenant.oid : null,
        slateOid: slate.oid,
        triggerGroupOid: triggerGroup.oid,
        secretOid: secret.oid
      }
    });
  };

  let makeEvent = async (d: { registrationOid: bigint }) =>
    testDb.slateWebhookEvent.create({
      data: {
        ...getId('slateWebhookEvent'),
        status: 'succeeded',
        attemptCount: 1,
        webhookRegistrationOid: d.registrationOid,
        request: {
          method: 'POST',
          url: 'https://webhooks.test/receive/whk_test',
          headers: { 'content-type': 'application/json' },
          body: { encoding: 'base64', content: 'e30=' }
        }
      }
    });

  return { tenant, slate, triggerGroup, makeRegistration, makeEvent };
};

describe('slateWebhookEvent:list E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns webhook events for a tenant', async () => {
    let s = await scenario();
    let registration = await s.makeRegistration();
    let event = await s.makeEvent({ registrationOid: registration.oid });

    let result = await slatesHubClient.slateWebhookEvent.list({
      tenantId: s.tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: event.id,
      status: 'succeeded',
      attemptCount: 1,
      webhookRegistrationId: registration.id,
      slateId: s.slate.id,
      triggerGroupId: s.triggerGroup.id
    });
  });

  it('filters by webhookRegistrationIds', async () => {
    let s = await scenario();
    let first = await s.makeRegistration();
    let second = await s.makeRegistration();

    let event = await s.makeEvent({ registrationOid: first.oid });
    await s.makeEvent({ registrationOid: second.oid });

    let result = await slatesHubClient.slateWebhookEvent.list({
      tenantId: s.tenant.id,
      webhookRegistrationIds: [first.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(event.id);
  });
});

describe('slateWebhookEvent:get E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single webhook event by ID', async () => {
    let s = await scenario();
    let registration = await s.makeRegistration();
    let event = await s.makeEvent({ registrationOid: registration.oid });

    let result = await slatesHubClient.slateWebhookEvent.get({
      tenantId: s.tenant.id,
      webhookEventId: event.id
    });

    expect(result).toMatchObject({
      id: event.id,
      request: { method: 'POST' },
      slateResponse: null
    });
  });

  it('does not return events of another tenant', async () => {
    let s = await scenario();
    let registration = await s.makeRegistration();
    let event = await s.makeEvent({ registrationOid: registration.oid });

    let otherTenant = await f.tenant.default();

    await expect(
      slatesHubClient.slateWebhookEvent.get({
        tenantId: otherTenant.id,
        webhookEventId: event.id
      })
    ).rejects.toThrow();
  });

  it('returns an event on a global registration once it reached the tenant', async () => {
    let s = await scenario();
    let registration = await s.makeRegistration({ owner: 'global' });
    let event = await s.makeEvent({ registrationOid: registration.oid });

    await expect(
      slatesHubClient.slateWebhookEvent.get({
        tenantId: s.tenant.id,
        webhookEventId: event.id
      })
    ).rejects.toThrow();

    let configSchema = await f.slateConfigSchema.default({
      slateOid: s.slate.oid,
      specificationOid: s.slate.currentVersion.specification.oid
    });
    let slateInstance = await testDb.slateInstance.create({
      data: { ...getId('slateInstance'), slateOid: s.slate.oid, tenantOid: s.tenant.oid }
    });
    let instanceConfig = await f.slateInstanceConfig.default({
      instanceOid: slateInstance.oid,
      schemaOid: configSchema.oid,
      tenantOid: s.tenant.oid
    });
    let triggerRegistration = await testDb.triggerRegistration.create({
      data: {
        ...getId('triggerRegistration'),
        tenantOid: s.tenant.oid,
        slateOid: s.slate.oid,
        instanceOid: slateInstance.oid,
        instanceConfigOid: instanceConfig.oid
      }
    });
    let registrationInstance = await testDb.triggerRegistrationInstance.create({
      data: {
        ...getId('triggerRegistrationInstance'),
        triggerRegistrationOid: triggerRegistration.oid,
        triggerGroupOid: s.triggerGroup.oid
      }
    });
    await testDb.triggerRawEvent.create({
      data: {
        ...getId('triggerRawEvent'),
        source: 'webhook',
        triggerRegistrationInstanceOid: registrationInstance.oid,
        webhookEventOid: event.oid,
        payload: {},
        triggerIds: ['message.created'],
        pendingTriggerMapCount: 1
      }
    });

    let result = await slatesHubClient.slateWebhookEvent.get({
      tenantId: s.tenant.id,
      webhookEventId: event.id
    });

    expect(result.id).toBe(event.id);
  });
});

describe('slateWebhookEvent:getMany E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple webhook events by IDs', async () => {
    let s = await scenario();
    let registration = await s.makeRegistration();

    let first = await s.makeEvent({ registrationOid: registration.oid });
    let second = await s.makeEvent({ registrationOid: registration.oid });

    let result = await slatesHubClient.slateWebhookEvent.getMany({
      tenantId: s.tenant.id,
      webhookEventIds: [first.id, second.id]
    });

    expect(result.map(e => e.id).sort()).toEqual([first.id, second.id].sort());
  });
});
