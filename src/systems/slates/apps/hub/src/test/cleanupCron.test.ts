import { subDays } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanupExpiredSlateVersionDiscoveries } from '../queues/cron/cleanup';
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
