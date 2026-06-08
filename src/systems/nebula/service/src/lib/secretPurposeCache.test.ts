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

    await expect(secretPurposeCache.getByIdentifierOrLoad('registry_credentials')).resolves.toMatchObject({
      oid: 101
    });
    await expect(secretPurposeCache.getByOidOrLoad(102)).resolves.toMatchObject({
      identifier: 'oauth_token'
    });
  });

  it('set populates both maps without requiring loadAll', async () => {
    let purpose = await testDb.secretPurpose.create({
      data: {
        oid: 201,
        identifier: 'server_config_value'
      }
    });

    secretPurposeCache.set(purpose);

    await expect(secretPurposeCache.getByIdentifierOrLoad('server_config_value')).resolves.toEqual(
      purpose
    );
    await expect(secretPurposeCache.getByOidOrLoad(201)).resolves.toEqual(purpose);
  });

  it('clear allows loadAll to run again on the next lookup', async () => {
    await testDb.secretPurpose.create({
      data: {
        oid: 301,
        identifier: 'oauth_connection_credentials'
      }
    });

    await secretPurposeCache.loadAll();
    secretPurposeCache.clear();

    await expect(
      secretPurposeCache.getByIdentifierOrLoad('oauth_connection_credentials')
    ).resolves.toMatchObject({
      oid: 301,
      identifier: 'oauth_connection_credentials'
    });
  });

  it('getByIdentifierOrLoad fetches purposes added after loadAll', async () => {
    await secretPurposeCache.loadAll();

    let purpose = await testDb.secretPurpose.create({
      data: {
        oid: 401,
        identifier: 'slate_oauth_setup'
      }
    });

    await expect(secretPurposeCache.getByIdentifierOrLoad('slate_oauth_setup')).resolves.toEqual(
      purpose
    );
    await expect(secretPurposeCache.getByOidOrLoad(401)).resolves.toEqual(purpose);
  });

  it('getByOidOrLoad fetches purposes added after loadAll', async () => {
    await secretPurposeCache.loadAll();

    let purpose = await testDb.secretPurpose.create({
      data: {
        oid: 402,
        identifier: 'slate_oauth_credentials'
      }
    });

    await expect(secretPurposeCache.getByOidOrLoad(402)).resolves.toEqual(purpose);
    await expect(secretPurposeCache.getByIdentifierOrLoad('slate_oauth_credentials')).resolves.toEqual(
      purpose
    );
  });
});
