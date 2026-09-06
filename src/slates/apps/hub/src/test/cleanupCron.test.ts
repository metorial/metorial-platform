import { subDays } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import { getId } from '../id';
import {
  cleanupExpiredSlateVersionDiscoveries,
  cleanupExpiredTriggerRoutingDrops
} from '../queues/cron/cleanup';
import { fixtures } from './fixtures';
import { cleanDatabase, testDb } from './setup';

describe('cleanupExpiredSlateVersionDiscoveries', () => {
  let f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('deletes discoveries older than five days and keeps recent ones', async () => {
    let slate = await f.slate.complete();

    let expiredDiscovery = await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid,
      overrides: {
        createdAt: subDays(new Date(), 6)
      }
    });

    let recentDiscovery = await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid,
      overrides: {
        createdAt: subDays(new Date(), 4)
      }
    });

    await cleanupExpiredSlateVersionDiscoveries();

    expect(
      await testDb.slateVersionDiscovery.findUnique({
        where: { id: expiredDiscovery.id }
      })
    ).toBeNull();

    expect(
      await testDb.slateVersionDiscovery.findUnique({
        where: { id: recentDiscovery.id }
      })
    ).not.toBeNull();
  });
});

describe('cleanupExpiredTriggerRoutingDrops', () => {
  let f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('deletes drop counts older than thirty days and keeps recent ones', async () => {
    let slate = await f.slate.complete();
    let tenant = await f.tenant.default();

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
        mostRecentSpecificationOid: slate.currentVersion.specification.oid
      }
    });

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
        slateOid: slate.oid,
        triggerGroupOid: triggerGroup.oid,
        tenantOid: tenant.oid,
        secretOid: secret.oid
      }
    });

    let makeDrop = (reason: 'no_match' | 'no_matcher', bucketStart: Date) =>
      testDb.triggerRoutingDrop.create({
        data: {
          ...getId('triggerRoutingDrop'),
          reason,
          bucketStart,
          count: 1,
          tenantOid: tenant.oid,
          triggerGroupOid: triggerGroup.oid,
          webhookRegistrationOid: webhookRegistration.oid
        }
      });

    let expired = await makeDrop('no_match', subDays(new Date(), 31));
    let recent = await makeDrop('no_matcher', subDays(new Date(), 29));

    await cleanupExpiredTriggerRoutingDrops();

    expect(
      await testDb.triggerRoutingDrop.findUnique({ where: { id: expired.id } })
    ).toBeNull();
    expect(
      await testDb.triggerRoutingDrop.findUnique({ where: { id: recent.id } })
    ).not.toBeNull();
  });
});
