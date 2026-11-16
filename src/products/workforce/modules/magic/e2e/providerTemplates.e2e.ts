import { expectServiceError, firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { providerTemplateService } from '../src';
import {
  createConsumer,
  createIntegration,
  createProviderTemplate,
  createServer,
  grantTemplateAccess,
  ids,
  listServerIds
} from './_fixtures';

let listTemplateIds = async (
  fixture: OrganizationFixture,
  filters: Omit<
    Parameters<typeof providerTemplateService.listProviderTemplates>[0],
    'instance'
  >
) =>
  ids(
    await firstPage(
      await providerTemplateService.listProviderTemplates({
        instance: fixture.instance,
        ...filters
      })
    )
  );

describe('module-magic provider templates', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('keeps one template per integration', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let integration = await createIntegration(fixture);
    let name = uniqueId('Provider Template');

    let template = await createProviderTemplate(fixture, integration.id, name);
    expect(template).toMatchObject({
      status: 'active',
      name,
      metadata: { source: 'e2e' },
      hasSubspaceBacking: true,
      subspaceIntegrationId: integration.id
    });
    let row = await db.providerTemplate.findUniqueOrThrow({ where: { id: template.id } });
    expect(row.instanceOid).toBe(fixture.instance.oid);

    let again = await createProviderTemplate(fixture, integration.id);
    expect(again.id).toBe(template.id);
    expect(again.name).toBe(name);
    expect(
      await db.providerTemplate.count({ where: { subspaceIntegrationId: integration.id } })
    ).toBe(1);

    expect(await listTemplateIds(fixture, { integrationIds: [integration.id] })).toEqual([
      template.id
    ]);
    let fetched = await providerTemplateService.getProviderTemplateById({
      instance: fixture.instance,
      providerTemplateId: template.id
    });
    expect(fetched.id).toBe(template.id);
  });

  it('updates, archives and resurrects a template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let integration = await createIntegration(fixture);
    let template = await createProviderTemplate(fixture, integration.id);

    let updated = await providerTemplateService.updateProviderTemplate({
      providerTemplate: template,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: 'Renamed template', description: 'Updated' }
    });
    expect(updated).toMatchObject({ name: 'Renamed template', description: 'Updated' });

    let archived = await providerTemplateService.archiveProviderTemplate({
      providerTemplate: updated,
      instance: fixture.instance,
      auditScope: fixture.auditScope
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeTruthy();
    expect(await listTemplateIds(fixture, { ids: [template.id] })).toEqual([]);
    expect(
      await listTemplateIds(fixture, { ids: [template.id], status: ['archived'] })
    ).toEqual([template.id]);

    await expectServiceError(
      providerTemplateService.updateProviderTemplate({
        providerTemplate: archived,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        input: { name: 'Too late' }
      }),
      'precondition_failed'
    );
    await expectServiceError(
      providerTemplateService.archiveProviderTemplate({
        providerTemplate: archived,
        instance: fixture.instance,
        auditScope: fixture.auditScope
      }),
      'precondition_failed'
    );

    let resurrected = await createProviderTemplate(fixture, integration.id, 'Resurrected');
    expect(resurrected).toMatchObject({
      id: template.id,
      status: 'active',
      name: 'Resurrected',
      archivedAt: null
    });
  });

  it('refuses integrations and templates of another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let template = await createProviderTemplate(
      fixture,
      (await createIntegration(fixture)).id
    );
    let foreignIntegration = await createIntegration(other);

    await expectServiceError(
      createProviderTemplate(fixture, foreignIntegration.id),
      'not_found'
    );
    expect(
      await db.providerTemplate.count({
        where: { subspaceIntegrationId: foreignIntegration.id }
      })
    ).toBe(0);

    await expectServiceError(
      providerTemplateService.getProviderTemplateById({
        instance: other.instance,
        providerTemplateId: template.id
      }),
      'not_found'
    );
    expect(await listTemplateIds(other, { ids: [template.id] })).toEqual([]);
  });

  it('creates consumer servers from a template', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let template = await createProviderTemplate(
      fixture,
      (await createIntegration(fixture)).id
    );

    let server = await createServer(fixture, {
      providerTemplateId: template.id,
      source: 'consumer_provider_template'
    });
    expect(server).toMatchObject({
      providerTemplateId: template.id,
      source: 'consumer_provider_template',
      hasSubspaceBacking: true
    });

    expect(await listServerIds(fixture, { providerTemplateIds: [template.id] })).toEqual([]);
    expect(
      await listServerIds(fixture, {
        providerTemplateIds: [template.id],
        owners: ['consumer']
      })
    ).toEqual([server.id]);
  });

  it('lets consumers read only the templates they were granted', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let consumer = await createConsumer(fixture);
    let granted = await createProviderTemplate(fixture, (await createIntegration(fixture)).id);
    let hidden = await createProviderTemplate(fixture, (await createIntegration(fixture)).id);
    await grantTemplateAccess(fixture, consumer, granted);
    let accessTags = consumer.accessTagOid;
    let get = (providerTemplateId: string) =>
      providerTemplateService.getProviderTemplateById({
        instance: fixture.instance,
        providerTemplateId,
        accessTags
      });

    expect((await get(granted.id)).id).toBe(granted.id);
    await expectServiceError(get(hidden.id), 'forbidden');
    expect(await listTemplateIds(fixture, { accessTags })).toEqual([granted.id]);

    await providerTemplateService.archiveProviderTemplate({
      providerTemplate: granted,
      instance: fixture.instance,
      auditScope: fixture.auditScope
    });
    await expectServiceError(get(granted.id), 'not_found');
  });
});
