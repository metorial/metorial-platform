import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { integrationInstanceService, integrationService } from '../src';

let workerTimeout = { timeoutMs: 45_000, intervalMs: 500 };

describe('module-integration integration instances', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createIntegration = async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let integration = await integrationService.createIntegration({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Integration') }
    });

    return { fixture, integration };
  };

  let createInstance = async () => {
    let { fixture, integration } = await createIntegration();
    let integrationInstance = await integrationInstanceService.createIntegrationInstance({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integration,
      input: { name: uniqueId('Instance'), description: 'Initial', metadata: { a: 1 } }
    });

    return { fixture, integration, integrationInstance };
  };

  let getInstance = async (
    fixture: { instance: Awaited<ReturnType<typeof loadOrganizationFixture>>['instance'] },
    integrationInstanceId: string
  ) =>
    integrationInstanceService.getIntegrationInstanceById({
      instance: fixture.instance,
      integrationInstanceId
    });

  it('creates a draft instance and the worker gives it a default session template', async () => {
    let { fixture, integration } = await createIntegration();
    let name = uniqueId('Instance');

    let integrationInstance = await integrationInstanceService.createIntegrationInstance({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integration,
      input: { name: `  ${name}  `, description: '  Described  ', metadata: { a: 1 } }
    });
    expect(integrationInstance.integrationInstanceProviders).toEqual([]);

    let row = await subspaceDb.integrationInstance.findUniqueOrThrow({
      where: { id: integrationInstance.id }
    });
    expect(row).toMatchObject({
      name,
      description: 'Described',
      metadata: { a: 1 },
      status: 'draft',
      isHiddenDraft: false,
      isParentDeleted: false,
      isMagicMcpBacking: false,
      isAdapterBacking: false,
      archivedAt: null,
      integrationOid: integration.oid,
      tenantOid: integration.tenantOid,
      environmentOid: integration.environmentOid
    });

    let template = await eventually(
      () =>
        subspaceDb.sessionTemplate.findFirstOrThrow({
          where: { defaultSessionTemplateForIntegrationInstanceOid: row.oid }
        }),
      workerTimeout
    );
    expect(template).toMatchObject({
      status: 'active',
      isInternal: true,
      integrationInstanceOid: row.oid,
      tenantOid: row.tenantOid
    });

    let fetched = await getInstance(fixture, integrationInstance.id);
    expect(fetched.defaultSessionTemplate?.id).toBe(template.id);
  });

  it('updates only the supplied fields', async () => {
    let { fixture, integrationInstance } = await createInstance();
    let renamed = uniqueId('Renamed');

    let updated = await integrationInstanceService.updateIntegrationInstance({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integrationInstance: await getInstance(fixture, integrationInstance.id),
      input: { name: `  ${renamed}  ` }
    });
    expect(updated).toMatchObject({
      name: renamed,
      description: 'Initial',
      metadata: { a: 1 },
      status: 'draft'
    });

    await integrationInstanceService.updateIntegrationInstance({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integrationInstance: await getInstance(fixture, integrationInstance.id),
      input: { description: null, privateMetadata: { b: 2 } }
    });

    let row = await subspaceDb.integrationInstance.findUniqueOrThrow({
      where: { id: integrationInstance.id }
    });
    expect(row).toMatchObject({
      name: renamed,
      description: null,
      metadata: { a: 1 },
      privateMetadata: { b: 2 }
    });
  });

  it('clears metadata when it is updated to null', async () => {
    let { fixture, integrationInstance } = await createInstance();

    await integrationInstanceService.updateIntegrationInstance({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integrationInstance: await getInstance(fixture, integrationInstance.id),
      input: { metadata: null }
    });

    let row = await subspaceDb.integrationInstance.findUniqueOrThrow({
      where: { id: integrationInstance.id }
    });
    expect(row.metadata).toBeNull();
  });

  it('archives an instance and rejects further edits and use', async () => {
    let { fixture, integrationInstance } = await createInstance();
    let { instance, auditScope } = fixture;

    let archived = await integrationInstanceService.archiveIntegrationInstance({
      instance,
      auditScope,
      integrationInstance
    });
    expect(archived.status).toBe('archived');

    let row = await subspaceDb.integrationInstance.findUniqueOrThrow({
      where: { id: integrationInstance.id }
    });
    expect(row.status).toBe('archived');
    expect(row.archivedAt).toBeInstanceOf(Date);

    let fetched = await getInstance(fixture, integrationInstance.id);
    expect(fetched.status).toBe('archived');
    expect(
      await firstPage(
        await integrationInstanceService.listIntegrationInstances({
          instance,
          ids: [integrationInstance.id]
        })
      )
    ).toEqual([]);
    let listedArchived = await firstPage(
      await integrationInstanceService.listIntegrationInstances({
        instance,
        ids: [integrationInstance.id],
        status: ['archived']
      })
    );
    expect(listedArchived.map(item => item.id)).toEqual([integrationInstance.id]);

    await expectServiceError(
      integrationInstanceService.updateIntegrationInstance({
        instance,
        auditScope,
        integrationInstance: fetched,
        input: { name: uniqueId('Renamed') }
      }),
      'gone'
    );
    await expectServiceError(
      integrationInstanceService.archiveIntegrationInstance({
        instance,
        auditScope,
        integrationInstance: fetched
      }),
      'gone'
    );
    await expectServiceError(
      integrationInstanceService.createSessionTemplateForIntegrationInstance({
        instance,
        integrationInstance: fetched,
        input: {}
      }),
      'use_after_delete'
    );
  });

  it('archives the default session template of an archived instance', async () => {
    let { fixture, integrationInstance } = await createInstance();

    let template = await eventually(
      () =>
        subspaceDb.sessionTemplate.findFirstOrThrow({
          where: { defaultSessionTemplateForIntegrationInstanceOid: integrationInstance.oid }
        }),
      workerTimeout
    );

    await integrationInstanceService.archiveIntegrationInstance({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      integrationInstance
    });

    await eventually(async () => {
      let archivedTemplate = await subspaceDb.sessionTemplate.findUniqueOrThrow({
        where: { oid: template.oid }
      });
      expect(archivedTemplate.status).toBe('archived');
    }, workerTimeout);
  });

  it('rejects unknown instance ids', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    await expectServiceError(
      integrationInstanceService.getIntegrationInstanceById({
        instance,
        integrationInstanceId: uniqueId('missing-instance')
      }),
      'not_found'
    );
  });

  it('filters instances by integration and status and pages through them', async () => {
    let { fixture, integration } = await createIntegration();
    let { integration: otherIntegration } = await createIntegration();
    let { instance, auditScope } = fixture;

    let instances = [];
    for (let index = 0; index < 3; index++) {
      instances.push(
        await integrationInstanceService.createIntegrationInstance({
          instance,
          auditScope,
          integration,
          input: { name: uniqueId('Instance') }
        })
      );
    }
    let unrelated = await integrationInstanceService.createIntegrationInstance({
      instance,
      auditScope,
      integration: otherIntegration,
      input: { name: uniqueId('Instance') }
    });
    let ids = instances.map(item => item.id);

    let paginator = await integrationInstanceService.listIntegrationInstances({
      instance,
      integrationIds: [integration.id]
    });
    let seen: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 10; page++) {
      let list = await paginator.run({ limit: 1, after });
      seen.push(...list.items.map(item => item.id));

      if (!list.pagination.hasNextPage) break;
      after = list.items.at(-1)!.id;
    }
    expect(seen.sort()).toEqual([...ids].sort());
    expect(seen).not.toContain(unrelated.id);

    expect(
      (
        await firstPage(
          await integrationInstanceService.listIntegrationInstances({
            instance,
            integrationIds: [integration.id],
            status: ['active']
          })
        )
      ).map(item => item.id)
    ).toEqual([]);
    expect(
      (
        await firstPage(
          await integrationInstanceService.listIntegrationInstances({
            instance,
            integrationIds: [integration.id],
            status: ['draft']
          })
        )
      )
        .map(item => item.id)
        .sort()
    ).toEqual([...ids].sort());
  });

  it('archives the instances of an archived integration through the worker', async () => {
    let { fixture, integration, integrationInstance } = await createInstance();
    let { instance, auditScope } = fixture;

    await integrationService.archiveIntegration({ instance, auditScope, integration });

    await eventually(async () => {
      let row = await subspaceDb.integrationInstance.findUniqueOrThrow({
        where: { id: integrationInstance.id }
      });
      expect(row).toMatchObject({ isParentDeleted: true, status: 'archived' });
    }, workerTimeout);

    await expectServiceError(getInstance(fixture, integrationInstance.id), 'not_found');
    let withDeleted = await integrationInstanceService.getIntegrationInstanceById({
      instance,
      integrationInstanceId: integrationInstance.id,
      allowDeleted: true
    });
    expect(withDeleted.status).toBe('archived');
  });

  it('does not expose or modify instances of another organization', async () => {
    let { integration, integrationInstance } = await createInstance();
    let other = await loadOrganizationFixture(otherOrg.ids);

    await expectServiceError(getInstance(other, integrationInstance.id), 'not_found');
    expect(
      await firstPage(
        await integrationInstanceService.listIntegrationInstances({
          instance: other.instance,
          ids: [integrationInstance.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await integrationInstanceService.listIntegrationInstances({
          instance: other.instance,
          integrationIds: [integration.id]
        })
      )
    ).toEqual([]);

    await expect(
      integrationInstanceService.updateIntegrationInstance({
        instance: other.instance,
        auditScope: other.auditScope,
        integrationInstance,
        input: { name: uniqueId('Hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      integrationInstanceService.archiveIntegrationInstance({
        instance: other.instance,
        auditScope: other.auditScope,
        integrationInstance
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      integrationInstanceService.createSessionForIntegrationInstance({
        instance: other.instance,
        integrationInstance,
        input: {}
      })
    ).rejects.toThrow('Tenant mismatch');

    let row = await subspaceDb.integrationInstance.findUniqueOrThrow({
      where: { id: integrationInstance.id }
    });
    expect(row).toMatchObject({ name: integrationInstance.name, status: 'draft' });
  });
});
