import { describe, expect, it } from 'vitest';
import { db as testDb } from '../src/db';
import { shuttleClient } from './client';
import { fixtures } from './fixtures';

describe('server:list E2E', () => {
  const f = fixtures(testDb);

  it('returns servers for a tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.default();
    const serverA1 = await f.server.default({ tenantOid: tenantA.oid });
    const serverA2 = await f.server.default({ tenantOid: tenantA.oid });
    const serverB = await f.server.default({ tenantOid: tenantB.oid });

    const result = await shuttleClient.server.list({
      tenantId: tenantA.id,
      limit: 10
    });

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: serverA1.id,
          type: serverA1.type,
          name: serverA1.name,
          description: serverA1.description,
          tenantId: tenantA.id,
          currentVersionId: null,
          draft: expect.objectContaining({
            configSchema: serverA1.draftConfigSchema,
            configTransformer: serverA1.draftConfigTransformer
          })
        }),
        expect.objectContaining({
          id: serverA2.id,
          type: serverA2.type,
          name: serverA2.name,
          description: serverA2.description,
          tenantId: tenantA.id,
          currentVersionId: null,
          draft: expect.objectContaining({
            configSchema: serverA2.draftConfigSchema,
            configTransformer: serverA2.draftConfigTransformer
          })
        })
      ])
    );
    expect(result.items).toEqual(
      expect.not.arrayContaining([
        {
          id: serverB.id
        }
      ])
    );
  });
});

describe('server:get E2E', () => {
  const f = fixtures(testDb);

  it('returns a single server by ID', async () => {
    const tenant = await f.tenant.default();
    const server = await f.server.default({ tenantOid: tenant.oid });

    const result = await shuttleClient.server.get({
      tenantId: tenant.id,
      serverId: server.id
    });

    expect(result).toMatchObject({
      id: server.id,
      type: server.type,
      name: server.name,
      description: server.description,
      tenantId: tenant.id,
      currentVersionId: null,
      draft: expect.objectContaining({
        configSchema: server.draftConfigSchema,
        configTransformer: server.draftConfigTransformer
      })
    });
  });

  it('returns server with description', async () => {
    const tenant = await f.tenant.default();
    const server = await f.server.withDescription('Test description', {
      tenantOid: tenant.oid
    });

    const result = await shuttleClient.server.get({
      tenantId: tenant.id,
      serverId: server.id
    });

    expect(result).toMatchObject({
      id: server.id,
      type: server.type,
      name: server.name,
      description: 'Test description',
      tenantId: tenant.id,
      currentVersionId: null,
      draft: expect.objectContaining({
        configSchema: server.draftConfigSchema,
        configTransformer: server.draftConfigTransformer
      })
    });
  });

  it('rejects when server belongs to another tenant', async () => {
    const tenantA = await f.tenant.default();
    const tenantB = await f.tenant.default();
    const serverA = await f.server.default({ tenantOid: tenantA.oid });
    await f.server.default({ tenantOid: tenantB.oid });

    await expect(
      shuttleClient.server.get({
        tenantId: tenantB.id,
        serverId: serverA.id
      })
    ).rejects.toThrow('could not be found');
  });
});

describe('server:update E2E', () => {
  const f = fixtures(testDb);

  it('updates server name and description', async () => {
    const tenant = await f.tenant.default();
    const server = await f.server.default({ tenantOid: tenant.oid });

    const result = await shuttleClient.server.update({
      tenantId: tenant.id,
      serverId: server.id,
      name: 'New Name',
      description: 'New description'
    });

    expect(result).toMatchObject({
      id: server.id,
      type: server.type,
      name: 'New Name',
      description: 'New description',
      tenantId: tenant.id,
      currentVersionId: null,
      draft: expect.objectContaining({
        configSchema: server.draftConfigSchema,
        configTransformer: server.draftConfigTransformer
      })
    });
  });
});
