import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

describe('skill template resource delegation', () => {
  beforeEach(cleanDatabase);

  it('idempotently syncs a Metorial-owned target and hydrates its delegated resources', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: 'test-template-solution'
    });
    let client = createSubspaceControllerRootTestClient({
      headers: { 'Subspace-Solution-Id': solution.id }
    });
    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: 'test-template-tenant',
      environments: [
        {
          name: 'Development',
          identifier: 'test-template-tenant-dev',
          type: 'development'
        }
      ]
    });
    let environment = await testDb.environment.findFirstOrThrow({
      where: {
        identifier: 'test-template-tenant-dev',
        tenant: { id: tenant.id }
      }
    });
    let input = {
      tenantId: tenant.id,
      environmentId: environment.id,
      id: 'skt_metorial',
      status: 'active' as const,
      owner: 'tenant' as const,
      slug: 'metorial-template',
      name: 'Metorial Template',
      description: 'Resource target owned by Metorial',
      metadata: { source: 'metorial' },
      storeId: 'str_metorial',
      storeTemplateId: 'stt_metorial',
      systemIdentifier: null,
      sourceSkillId: null
    };

    let first = await client.skillTemplate.syncResourceTarget(input);
    let second = await client.skillTemplate.syncResourceTarget(input);
    let hydrated = await client.skillTemplate.hydrateResources({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillTemplateIds: [input.id, 'skt_missing']
    });
    let records = await testDb.skillTemplate.findMany({ where: { id: input.id } });

    expect(first.skillTemplateId).toBe(input.id);
    expect(second.skillTemplateId).toBe(input.id);
    expect(records).toHaveLength(1);
    expect(hydrated).toEqual([{ skillTemplateId: input.id, items: [] }]);
  });
});
