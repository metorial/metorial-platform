import { beforeEach, describe, expect, it } from 'vitest';
import { cargoClient } from '../../../../../../cargo/service/src/test/client';
import { cleanDatabase as cleanCargoDatabase } from '../../../../../../cargo/service/src/test/setup';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('skillTemplate.e2e', () => {
  beforeEach(async () => {
    await Promise.all([cleanDatabase(), cleanCargoDatabase()]);
  });

  it('creates a template from a skill using a duplicated cargo store snapshot', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: 'test-solution'
    });
    let client = createSubspaceControllerRootTestClient({
      headers: {
        'Subspace-Solution-Id': solution.id
      }
    });

    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: 'test-tenant',
      logRetentionInDays: 14,
      environments: [
        {
          name: 'Development',
          identifier: 'test-tenant-dev',
          type: 'development'
        }
      ]
    });
    let skill = await client.skill.create({
      tenantId: tenant.id,
      environmentId: 'test-tenant-dev',
      name: 'Support Skill'
    });
    let cargoTenant = await cargoClient.tenant.upsert({
      identifier: tenant.identifier,
      name: tenant.name
    });
    let cargoEnvironment = await cargoClient.environment.upsert({
      tenantId: cargoTenant.id,
      identifier: 'test-tenant-dev',
      name: 'Development',
      type: 'development'
    });

    await cargoClient.document.create({
      tenantId: cargoTenant.id,
      environmentId: cargoEnvironment.id,
      documentId: 'cdoc_subspace_template_source',
      title: 'Readme',
      content: 'template snapshot',
      store: {
        id: skill.storeId,
        path: '/docs/readme.md'
      }
    });

    let template = await client.skillTemplate.create({
      tenantId: tenant.id,
      environmentId: 'test-tenant-dev',
      skillId: skill.id,
      name: 'Support Skill Template'
    });
    let templateStoreItems = await cargoClient.storeItem.list({
      tenantId: cargoTenant.id,
      environmentId: cargoEnvironment.id,
      storeId: template.storeId!,
      limit: 20
    });

    await cargoClient.document.create({
      tenantId: cargoTenant.id,
      environmentId: cargoEnvironment.id,
      documentId: 'cdoc_subspace_template_late_change',
      title: 'Later Change',
      content: 'should not be copied',
      store: {
        id: skill.storeId,
        path: '/docs/later.md'
      }
    });

    let instantiatedSkill = await cargoClient.skill.create({
      tenantId: cargoTenant.id,
      environmentId: cargoEnvironment.id,
      skillId: 'csk_subspace_template_instance',
      parentSkillTemplateId: template.id,
      name: 'Instantiated From Subspace Template'
    });
    let instantiatedItems = await cargoClient.storeItem.list({
      tenantId: cargoTenant.id,
      environmentId: cargoEnvironment.id,
      storeId: instantiatedSkill.storeId,
      limit: 20
    });

    expect(template.storeId).toBeTruthy();
    expect(template.storeId).not.toBe(skill.storeId);
    expect(template.items).toEqual([]);
    expect(templateStoreItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(templateStoreItems.items.map(item => item.path)).not.toContain('/docs/later.md');
    expect(instantiatedItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(instantiatedItems.items.map(item => item.path)).not.toContain('/docs/later.md');
  });
});
