import { subDays } from 'date-fns';
import { beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, testDb } from '../../test/setup';
import { purgeDisabledSecret } from '../purgeDisabledSecrets';

describe('purgeDisabledSecret', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('marks disabled secrets as deleted', async () => {
    let tenant = await testDb.tenant.create({
      data: {
        oid: 1n,
        id: 'tenant-1',
        identifier: 'tenant-1',
        name: 'Tenant 1'
      }
    });
    let consumer = await testDb.consumer.create({
      data: {
        oid: 2n,
        id: 'consumer-1',
        identifier: 'consumer-1',
        name: 'Consumer 1',
        status: 'active'
      }
    });
    let secret = await testDb.secret.create({
      data: {
        oid: 3n,
        id: 'secret-1',
        tenantOid: tenant.oid,
        consumerOid: consumer.oid,
        purpose: 'test',
        status: 'disabled',
        disabledAt: subDays(new Date(), 15)
      }
    });

    await purgeDisabledSecret(secret.oid);

    let updated = await testDb.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    expect(updated.status).toBe('deleted');
    expect(updated.deletedAt).toBeInstanceOf(Date);
  });

  it('ignores secrets that are not disabled', async () => {
    let tenant = await testDb.tenant.create({
      data: {
        oid: 4n,
        id: 'tenant-2',
        identifier: 'tenant-2',
        name: 'Tenant 2'
      }
    });
    let consumer = await testDb.consumer.create({
      data: {
        oid: 5n,
        id: 'consumer-2',
        identifier: 'consumer-2',
        name: 'Consumer 2',
        status: 'active'
      }
    });
    let secret = await testDb.secret.create({
      data: {
        oid: 6n,
        id: 'secret-2',
        tenantOid: tenant.oid,
        consumerOid: consumer.oid,
        purpose: 'test',
        status: 'active'
      }
    });

    await purgeDisabledSecret(secret.oid);

    let updated = await testDb.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    expect(updated.status).toBe('active');
    expect(updated.deletedAt).toBeNull();
  });
});
