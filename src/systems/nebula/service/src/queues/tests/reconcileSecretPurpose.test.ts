import { beforeEach, describe, expect, it } from 'vitest';
import { reconcileSecretPurpose } from '../reconcileSecretPurpose';
import { cleanDatabase, testDb } from '../../test/setup';

describe('reconcileSecretPurpose', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('sets purposeOid from purposeLegacy', async () => {
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
        purposeLegacy: 'registry_credentials',
        status: 'active'
      }
    });

    await reconcileSecretPurpose(secret.oid);

    let updated = await testDb.secret.findUniqueOrThrow({
      where: { oid: secret.oid },
      include: { purpose: true }
    });
    expect(updated.purposeOid).toBeTypeOf('number');
    expect(updated.purpose?.identifier).toBe('registry_credentials');
  });

  it('is idempotent for secrets that already have purposeOid', async () => {
    let purpose = await testDb.secretPurpose.create({
      data: {
        oid: 501,
        identifier: 'oauth_token'
      }
    });
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
        purposeLegacy: 'oauth_token',
        purposeOid: purpose.oid,
        status: 'active'
      }
    });

    await reconcileSecretPurpose(secret.oid);

    let updated = await testDb.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    expect(updated.purposeOid).toBe(purpose.oid);
    expect(await testDb.secretPurpose.count()).toBe(1);
  });

  it('skips secrets without purposeLegacy', async () => {
    let tenant = await testDb.tenant.create({
      data: {
        oid: 7n,
        id: 'tenant-3',
        identifier: 'tenant-3',
        name: 'Tenant 3'
      }
    });
    let consumer = await testDb.consumer.create({
      data: {
        oid: 8n,
        id: 'consumer-3',
        identifier: 'consumer-3',
        name: 'Consumer 3',
        status: 'active'
      }
    });
    let secret = await testDb.secret.create({
      data: {
        oid: 9n,
        id: 'secret-3',
        tenantOid: tenant.oid,
        consumerOid: consumer.oid,
        status: 'active'
      }
    });

    await reconcileSecretPurpose(secret.oid);

    let updated = await testDb.secret.findUniqueOrThrow({ where: { oid: secret.oid } });
    expect(updated.purposeOid).toBeNull();
    expect(await testDb.secretPurpose.count()).toBe(0);
  });
});
