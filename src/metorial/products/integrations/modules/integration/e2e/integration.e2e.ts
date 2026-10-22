import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  integrationInstanceService,
  integrationService,
  integrationVersionService
} from '../src';

describe('module-integration', () => {
  let org = useOrganization();

  it('creates, versions, updates and archives an integration', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);
    let name = uniqueId('integration');

    let integration = await integrationService.createIntegration({
      instance,
      auditScope,
      input: { name, description: 'E2E integration', metadata: { e2e: true } }
    });
    expect(integration.name).toBe(name);
    expect(integration.status).toBe('active');
    expect(integration.providers).toEqual([]);
    expect(integration.currentVersion).toBeTruthy();

    let fetched = await integrationService.getIntegrationById({
      instance,
      integrationId: integration.id
    });
    expect(fetched.id).toBe(integration.id);

    let listed = await firstPage(
      await integrationService.listIntegrations({ instance, ids: [integration.id] })
    );
    expect(listed.map(item => item.id)).toEqual([integration.id]);

    let versions = await firstPage(
      await integrationVersionService.listIntegrationVersions({
        instance,
        integrationIds: [integration.id]
      })
    );
    expect(versions.map(version => version.id)).toEqual([integration.currentVersion!.id]);

    let renamed = uniqueId('renamed');
    let updated = await integrationService.updateIntegration({
      instance,
      auditScope,
      integration: fetched,
      input: { name: renamed, canOverrideToolFilters: true }
    });
    expect(updated.name).toBe(renamed);
    expect(updated.canOverrideToolFilters).toBe(true);
    expect(updated.canAttachCustomToolFilters).toBe(true);

    let archived = await integrationService.archiveIntegration({
      instance,
      auditScope,
      integration: updated
    });
    expect(archived.status).toBe('archived');

    expect(
      await firstPage(
        await integrationService.listIntegrations({ instance, ids: [integration.id] })
      )
    ).toEqual([]);
  });

  it('creates and archives a provider-less integration instance', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);

    let integration = await integrationService.createIntegration({
      instance,
      auditScope,
      input: { name: uniqueId('integration') }
    });

    let name = uniqueId('integration-instance');
    let integrationInstance = await integrationInstanceService.createIntegrationInstance({
      instance,
      auditScope,
      integration,
      input: { name }
    });
    expect(integrationInstance.name).toBe(name);
    expect(integrationInstance.status).toBe('draft');
    expect(integrationInstance.integrationOid).toBe(integration.oid);

    let fetched = await integrationInstanceService.getIntegrationInstanceById({
      instance,
      integrationInstanceId: integrationInstance.id
    });
    expect(fetched.id).toBe(integrationInstance.id);

    let listed = await firstPage(
      await integrationInstanceService.listIntegrationInstances({
        instance,
        integrationIds: [integration.id]
      })
    );
    expect(listed.map(item => item.id)).toEqual([integrationInstance.id]);

    let archived = await integrationInstanceService.archiveIntegrationInstance({
      instance,
      auditScope,
      integrationInstance: fetched
    });
    expect(archived.status).toBe('archived');

    await integrationService.archiveIntegration({ instance, auditScope, integration });
  });

  it('rejects unknown integration ids', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    await expect(
      integrationService.getIntegrationById({
        instance,
        integrationId: uniqueId('missing-integration')
      })
    ).rejects.toThrow(/could not be found/);
    await expect(
      integrationInstanceService.getIntegrationInstanceById({
        instance,
        integrationInstanceId: uniqueId('missing-instance')
      })
    ).rejects.toThrow(/could not be found/);
  });
});
