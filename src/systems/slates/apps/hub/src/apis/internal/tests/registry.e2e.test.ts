import _ from 'lodash';
import { beforeEach, describe, expect, it } from 'vitest';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('registry:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns registries', async () => {
    const registry = await f.registry.default();
    await f.registry.default();

    const result = await slatesHubClient.registry.list({ limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      object: 'registry',
      id: registry.id,
      status: registry.status,
      isPredefined: registry.isPredefined,
      identifier: registry.identifier,
      name: registry.name,
      url: registry.url,
      tenant: null,
      createdAt: expect.any(Date),
      lastSyncedAt: null
    });
  });
});

describe('registry:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single registry by ID', async () => {
    const registry = await f.registry.default();

    const result = await slatesHubClient.registry.get({
      registryId: registry.id
    });

    expect(result).toMatchObject({
      id: registry.id,
      identifier: registry.identifier,
      name: registry.name,
      url: registry.url
    });
  });
});

describe('registry:listAll E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns all registries', async () => {
    const tenant = await f.tenant.default();
    await Promise.all(_.times(3, () => f.registry.default()));

    const result = await slatesHubClient.registry.listAll({
      tenantId: tenant.id
    });

    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

describe('registry:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple registries by IDs', async () => {
    const reg1 = await f.registry.default();
    const reg2 = await f.registry.default();

    const result = await slatesHubClient.registry.getMany({
      registryIds: [reg1.id, reg2.id]
    });

    expect(result).toMatchObject([{ id: reg1.id }, { id: reg2.id }]);
  });
});
