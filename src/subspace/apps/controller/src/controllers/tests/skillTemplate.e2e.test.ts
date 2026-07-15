import { beforeEach, describe, expect, it } from 'vitest';
import { getId } from '@metorial-subspace/db';
import { cargoClient } from '../../../../../../cargo/service/src/test/client';
import { cleanDatabase as cleanCargoDatabase } from '../../../../../../cargo/service/src/test/setup';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

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
      name: 'Support Skill Template',
      metadata: { source: 'template' }
    });
    let templateStoreItems = await cargoClient.storeItem.list({
      tenantId: cargoTenant.id,
      environmentId: cargoEnvironment.id,
      storeId: template.storeId!,
      limit: 20
    });
    let [tenantRecord, environmentRecord, solutionRecord] = await Promise.all([
      testDb.tenant.findUniqueOrThrow({ where: { id: tenant.id } }),
      testDb.environment.findFirstOrThrow({
        where: {
          identifier: 'test-tenant-dev',
          tenant: { id: tenant.id }
        }
      }),
      testDb.solution.findUniqueOrThrow({ where: { id: solution.id } })
    ]);
    let integration = await testDb.integration.create({
      data: {
        ...getId('integration'),
        status: 'active',
        slug: 'template-integration',
        name: 'Template Integration',
        canAttachCustomToolFilters: false,
        canAttachCustomProviderConfig: false,
        canOverrideToolFilters: false,
        currentVersionIndex: 0,
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid,
        solutionOid: solutionRecord.oid
      }
    });
    let templateRecord = await testDb.skillTemplate.findUniqueOrThrow({
      where: { id: template.id }
    });
    await testDb.skillTemplateItem.create({
      data: {
        ...getId('skillTemplateItem'),
        skillTemplateOid: templateRecord.oid,
        integrationOid: integration.oid
      }
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

    let instantiatedSkill = await client.skill.create({
      tenantId: tenant.id,
      environmentId: 'test-tenant-dev',
      templateId: template.id,
      name: 'Instantiated From Subspace Template'
    });
    let instantiatedItems = await cargoClient.storeItem.list({
      tenantId: cargoTenant.id,
      environmentId: cargoEnvironment.id,
      storeId: instantiatedSkill.storeId,
      limit: 20
    });
    let instantiatedSkillItems = await testDb.skillItem.findMany({
      where: {
        skill: {
          id: instantiatedSkill.id
        }
      },
      include: {
        integration: true
      }
    });

    expect(template.storeId).toBeTruthy();
    expect(template.storeId).not.toBe(skill.storeId);
    expect(templateStoreItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(templateStoreItems.items.map(item => item.path)).not.toContain('/docs/later.md');
    expect(instantiatedItems.items.map(item => item.path)).toContain('/docs/readme.md');
    expect(instantiatedItems.items.map(item => item.path)).not.toContain('/docs/later.md');
    expect(instantiatedSkill.metadata).toEqual({ source: 'template' });
    expect(instantiatedSkillItems).toMatchObject([
      {
        status: 'active',
        type: 'integration',
        integration: {
          status: 'active',
          integrationOid: integration.oid
        }
      }
    ]);
  });
});
