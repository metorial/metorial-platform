import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  integrationInstanceService,
  integrationService,
  integrationVersionService
} from '../src';

let pageThrough = async <T extends { id: string }>(paginator: {
  run: (input: {
    limit?: number;
    after?: string;
  }) => Promise<{ items: T[]; pagination: { hasNextPage: boolean } }>;
}) => {
  let items: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < 20; page++) {
    let list = await paginator.run({ limit: 1, after });
    items.push(...list.items);

    if (!list.pagination.hasNextPage || !list.items.length) return items;
    after = list.items.at(-1)!.id;
  }

  throw new Error('The paginator still had more pages after 20 pages');
};

let searchToken = () => uniqueId('srch').replace(/-/g, '');

describe('module-integration integrations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createIntegration = async (input: { name?: string; description?: string } = {}) => {
    let fixture = await loadOrganizationFixture(org.ids);
    let integration = await integrationService.createIntegration({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: input.name ?? uniqueId('Integration'), description: input.description }
    });

    return { fixture, integration };
  };

  it('creates an integration with defaults, trimmed input and a first version', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Integration');

    let integration = await integrationService.createIntegration({
      instance,
      auditScope,
      input: {
        name: `  ${name}  `,
        description: '  Described  ',
        metadata: { team: 'e2e' },
        privateMetadata: { secret: true }
      }
    });

    let row = await subspaceDb.integration.findUniqueOrThrow({
      where: { id: integration.id },
      include: { versions: true }
    });
    expect(row).toMatchObject({
      name,
      description: 'Described',
      status: 'active',
      archivedAt: null,
      isMagicMcpBacking: false,
      isAdapterBacking: false,
      canAttachCustomToolFilters: true,
      canAttachCustomProviderConfig: false,
      canOverrideToolFilters: false,
      enableCallbackTools: false,
      useIntegrationNameForSessionProviderNameTemplatesOverride: null,
      currentVersionIndex: 1,
      metadata: { team: 'e2e' },
      privateMetadata: { secret: true }
    });
    expect(row.slug).toMatch(/^[a-z0-9-]+$/);
    expect(row.versions.map(version => version.oid)).toEqual([row.currentVersionOid]);
    expect(row.versions[0]).toMatchObject({ index: 1, status: 'active' });
  });

  it('gives integrations with the same name distinct slugs', async () => {
    let name = uniqueId('Integration');
    let first = await createIntegration({ name });
    let second = await createIntegration({ name });

    expect(second.integration.slug).not.toBe(first.integration.slug);
  });

  it('always allows custom tool filters when tool filters can be overridden', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);

    let integration = await integrationService.createIntegration({
      instance,
      auditScope,
      input: {
        name: uniqueId('Integration'),
        canAttachCustomToolFilters: false,
        canOverrideToolFilters: true
      }
    });
    expect(integration).toMatchObject({
      canAttachCustomToolFilters: true,
      canOverrideToolFilters: true
    });

    let updated = await integrationService.updateIntegration({
      instance,
      auditScope,
      integration: await integrationService.getIntegrationById({
        instance,
        integrationId: integration.id
      }),
      input: { canOverrideToolFilters: false, canAttachCustomToolFilters: false }
    });
    expect(updated).toMatchObject({
      canAttachCustomToolFilters: false,
      canOverrideToolFilters: false
    });
  });

  it('updates only the supplied fields without creating a new version', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);
    let integration = await integrationService.createIntegration({
      instance,
      auditScope,
      input: { name: uniqueId('Integration'), description: 'Initial', metadata: { a: 1 } }
    });

    let renamed = uniqueId('Renamed');
    let updated = await integrationService.updateIntegration({
      instance,
      auditScope,
      integration: await integrationService.getIntegrationById({
        instance,
        integrationId: integration.id
      }),
      input: { name: `  ${renamed}  `, enableCallbackTools: true }
    });
    expect(updated).toMatchObject({
      name: renamed,
      description: 'Initial',
      metadata: { a: 1 },
      enableCallbackTools: true,
      canAttachCustomProviderConfig: false
    });

    let cleared = await integrationService.updateIntegration({
      instance,
      auditScope,
      integration: await integrationService.getIntegrationById({
        instance,
        integrationId: integration.id
      }),
      input: { description: null, canAttachCustomProviderConfig: true }
    });
    expect(cleared).toMatchObject({ name: renamed, description: null });

    let row = await subspaceDb.integration.findUniqueOrThrow({
      where: { id: integration.id }
    });
    expect(row).toMatchObject({
      name: renamed,
      description: null,
      canAttachCustomProviderConfig: true,
      enableCallbackTools: true,
      currentVersionIndex: 1
    });
  });

  it('clears metadata when it is updated to null', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);
    let integration = await integrationService.createIntegration({
      instance,
      auditScope,
      input: { name: uniqueId('Integration'), metadata: { a: 1 } }
    });

    await integrationService.updateIntegration({
      instance,
      auditScope,
      integration: await integrationService.getIntegrationById({
        instance,
        integrationId: integration.id
      }),
      input: { metadata: null }
    });

    let row = await subspaceDb.integration.findUniqueOrThrow({
      where: { id: integration.id }
    });
    expect(row.metadata).toBeNull();
  });

  it('archives an integration and rejects further edits and use', async () => {
    let { fixture, integration } = await createIntegration();
    let { instance, auditScope } = fixture;

    let archived = await integrationService.archiveIntegration({
      instance,
      auditScope,
      integration
    });
    expect(archived.status).toBe('archived');

    let row = await subspaceDb.integration.findUniqueOrThrow({
      where: { id: integration.id }
    });
    expect(row.status).toBe('archived');
    expect(row.archivedAt).toBeInstanceOf(Date);

    let fetched = await integrationService.getIntegrationById({
      instance,
      integrationId: integration.id
    });
    expect(fetched.status).toBe('archived');

    expect(
      await firstPage(
        await integrationService.listIntegrations({ instance, ids: [integration.id] })
      )
    ).toEqual([]);
    let listedArchived = await firstPage(
      await integrationService.listIntegrations({
        instance,
        ids: [integration.id],
        status: ['archived']
      })
    );
    expect(listedArchived.map(item => item.id)).toEqual([integration.id]);

    await expectServiceError(
      integrationService.updateIntegration({
        instance,
        auditScope,
        integration: fetched,
        input: { name: uniqueId('Renamed') }
      }),
      'gone'
    );
    await expectServiceError(
      integrationService.archiveIntegration({ instance, auditScope, integration: fetched }),
      'gone'
    );
    await expectServiceError(
      integrationInstanceService.createIntegrationInstance({
        instance,
        auditScope,
        integration: fetched,
        input: { name: uniqueId('Instance') }
      }),
      'use_after_delete'
    );

    expect(
      await subspaceDb.integrationInstance.count({ where: { integrationOid: row.oid } })
    ).toBe(0);
  });

  it('rejects unknown integration and version ids', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    await expectServiceError(
      integrationService.getIntegrationById({
        instance,
        integrationId: uniqueId('missing-integration')
      }),
      'not_found'
    );
    await expectServiceError(
      integrationVersionService.getIntegrationVersionById({
        instance,
        integrationVersionId: uniqueId('missing-version')
      }),
      'not_found'
    );
  });

  it('lists integrations page by page', async () => {
    let created = [
      await createIntegration(),
      await createIntegration(),
      await createIntegration()
    ];
    let ids = created.map(({ integration }) => integration.id);
    let { instance } = created[0]!.fixture;

    let items = await pageThrough(
      await integrationService.listIntegrations({ instance, ids })
    );
    expect(items.map(item => item.id).sort()).toEqual([...ids].sort());
    expect(new Set(items.map(item => item.id)).size).toBe(ids.length);
  });

  it('finds integrations by search once they are indexed and drops them on archive', async () => {
    let token = searchToken();
    let { fixture, integration } = await createIntegration({
      name: `Searchable ${token}`,
      description: 'Indexed by the integrations worker'
    });
    let { instance, auditScope } = fixture;

    await eventually(
      async () => {
        let found = await firstPage(
          await integrationService.listIntegrations({ instance, search: token })
        );
        expect(found.map(item => item.id)).toEqual([integration.id]);
      },
      { timeoutMs: 15_000, intervalMs: 500 }
    );

    let other = await loadOrganizationFixture(otherOrg.ids);
    expect(
      await firstPage(
        await integrationService.listIntegrations({
          instance: other.instance,
          search: token
        })
      )
    ).toEqual([]);

    await integrationService.archiveIntegration({ instance, auditScope, integration });

    await eventually(
      async () => {
        let found = await firstPage(
          await integrationService.listIntegrations({
            instance,
            search: token,
            status: ['active', 'archived']
          })
        );
        expect(found).toEqual([]);
      },
      { timeoutMs: 15_000, intervalMs: 500 }
    );
  });

  it('lists and resolves integration versions', async () => {
    let { fixture, integration } = await createIntegration();
    let { instance } = fixture;

    let versions = await firstPage(
      await integrationVersionService.listIntegrationVersions({
        instance,
        integrationIds: [integration.id]
      })
    );
    expect(versions.map(version => version.id)).toEqual([integration.currentVersion!.id]);

    let version = await integrationVersionService.getIntegrationVersionById({
      instance,
      integrationVersionId: integration.currentVersion!.id
    });
    expect(version).toMatchObject({ index: 1, integrationOid: integration.oid });
    expect(version.providers).toEqual([]);
  });

  it('does not expose or modify integrations of another organization', async () => {
    let { integration } = await createIntegration();
    let other = await loadOrganizationFixture(otherOrg.ids);

    await expectServiceError(
      integrationService.getIntegrationById({
        instance: other.instance,
        integrationId: integration.id
      }),
      'not_found'
    );
    await expectServiceError(
      integrationVersionService.getIntegrationVersionById({
        instance: other.instance,
        integrationVersionId: integration.currentVersion!.id
      }),
      'not_found'
    );
    expect(
      await firstPage(
        await integrationService.listIntegrations({
          instance: other.instance,
          ids: [integration.id]
        })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await integrationVersionService.listIntegrationVersions({
          instance: other.instance,
          ids: [integration.currentVersion!.id]
        })
      )
    ).toEqual([]);

    await expect(
      integrationService.updateIntegration({
        instance: other.instance,
        auditScope: other.auditScope,
        integration,
        input: { name: uniqueId('Hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      integrationService.archiveIntegration({
        instance: other.instance,
        auditScope: other.auditScope,
        integration
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      integrationInstanceService.createIntegrationInstance({
        instance: other.instance,
        auditScope: other.auditScope,
        integration,
        input: { name: uniqueId('Instance') }
      })
    ).rejects.toThrow('Tenant mismatch');

    let row = await subspaceDb.integration.findUniqueOrThrow({
      where: { id: integration.id }
    });
    expect(row).toMatchObject({ name: integration.name, status: 'active' });
  });
});
