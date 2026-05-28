import { beforeEach, describe, expect, it } from 'vitest';
import { secretPurposeCache } from './secretPurposeCache';
import { cleanDatabase, testDb } from '../test/setup';

describe('secretPurposeCache', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('loads all purposes into both maps', async () => {
    await testDb.secretPurpose.createMany({
      data: [
        { oid: 101, identifier: 'registry_credentials' },
        { oid: 102, identifier: 'oauth_token' }
      ]
    });

    await secretPurposeCache.loadAll();

    expect(secretPurposeCache.getByIdentifier('registry_credentials')?.oid).toBe(101);
    expect(secretPurposeCache.getByOid(102)?.identifier).toBe('oauth_token');
  });

  it('set populates both maps without requiring loadAll', async () => {
    let purpose = await testDb.secretPurpose.create({
      data: {
        oid: 201,
        identifier: 'server_config_value'
      }
    });

    secretPurposeCache.set(purpose);

    expect(secretPurposeCache.getByIdentifier('server_config_value')).toEqual(purpose);
    expect(secretPurposeCache.getByOid(201)).toEqual(purpose);
  });

  it('clear resets the cache', async () => {
    await testDb.secretPurpose.create({
      data: {
        oid: 301,
        identifier: 'oauth_connection_credentials'
      }
    });

    await secretPurposeCache.loadAll();
    secretPurposeCache.clear();

    expect(secretPurposeCache.getByIdentifier('oauth_connection_credentials')).toBeUndefined();
    expect(secretPurposeCache.getByOid(301)).toBeUndefined();
  });
});
