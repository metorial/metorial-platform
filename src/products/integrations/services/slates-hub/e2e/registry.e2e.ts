import { listAll } from './helpers';
import _ from 'lodash';
import { describe, expect, it } from 'vitest';
import { getRegistryHeaders } from '../src/registry';
import { slatesHubClient } from './client';
import { fixtures } from './fixtures';
import { db as testDb } from '../src/db';

describe('registry:list E2E', () => {
  const f = fixtures(testDb);

  it('returns registries', async () => {
    const registry = await f.registry.default();
    await f.registry.default();

    const items = await listAll(page => slatesHubClient.registry.list(page));

    expect(items.find(i => i.id == registry.id)).toMatchObject({
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

  it('returns multiple registries by IDs', async () => {
    const reg1 = await f.registry.default();
    const reg2 = await f.registry.default();

    const result = await slatesHubClient.registry.getMany({
      registryIds: [reg1.id, reg2.id]
    });

    expect(result).toMatchObject([{ id: reg1.id }, { id: reg2.id }]);
  });
});

describe('registry:headers', () => {
  it('sends the sub-registry id on both headers', async () => {
    let headers = getRegistryHeaders({ token: 'tok', subRegistryId: 'acme' });

    expect(headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Metorial-Sub-Registry-Id': 'acme',
      'Slates-Sub-Registry-Id': 'acme'
    });
  });

  it('omits auth and sub-registry headers when unset', async () => {
    expect(getRegistryHeaders({})).toEqual({});
  });
});
