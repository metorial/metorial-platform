import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

describe('skill resource delegation', () => {
  beforeEach(cleanDatabase);

  it('idempotently syncs a Metorial-owned target and hydrates its delegated resources', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: 'test-skill-solution'
    });
    let client = createSubspaceControllerRootTestClient({
      headers: { 'Subspace-Solution-Id': solution.id }
    });
    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: 'test-skill-tenant',
      environments: [
        {
          name: 'Development',
          identifier: 'test-skill-tenant-dev',
          type: 'development'
        }
      ]
    });
    let environment = await testDb.environment.findFirstOrThrow({
      where: {
        identifier: 'test-skill-tenant-dev',
        tenant: { id: tenant.id }
      }
    });
    let input = {
      tenantId: tenant.id,
      environmentId: environment.id,
      id: 'skl_metorial',
      status: 'active' as const,
      slug: 'metorial-skill',
      name: 'Metorial Skill',
      description: 'Resource target owned by Metorial',
      metadata: { source: 'metorial' },
      image: null,
      clientName: null,
      clientDescription: null,
      clientMetadata: null,
      license: null,
      compatibility: null,
      storeId: 'str_metorial',
      parentSkillId: null,
      parentType: null,
      parentTemplateId: null
    };

    let first = await client.skill.syncResourceTarget(input);
    let second = await client.skill.syncResourceTarget(input);
    let hydrated = await client.skill.hydrateResources({
      tenantId: tenant.id,
      environmentId: environment.id,
      skillIds: [input.id, 'skl_missing']
    });
    let records = await testDb.skill.findMany({ where: { id: input.id } });

    expect(first.skillId).toBe(input.id);
    expect(second.skillId).toBe(input.id);
    expect(records).toHaveLength(1);
    expect(hydrated).toEqual([
      {
        skillId: input.id,
        items: [],
        integrations: [],
        providers: []
      }
    ]);
  });
});
