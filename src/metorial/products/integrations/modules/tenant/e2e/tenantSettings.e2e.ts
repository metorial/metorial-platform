import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { tenantService } from '../src';
import { loadScope, updateTenant } from './_fixtures';

describe('module-tenant tenant settings', () => {
  let org = useOrganization();

  it('provisions tenants with the default settings', async () => {
    let { tenant } = await loadScope(org.ids.instanceId);

    expect(tenant).toMatchObject({
      logRetentionInDays: 30,
      messageProcessingTimeoutMs: 30_000,
      enforceSessionExpiry: false,
      collectOperationDescriptionForToolCalls: true,
      dataRetentionLevel: 'full',
      storeToolCallAttachments: true,
      collectErrors: true,
      disableCallbacks: false,
      reducedSubprocessors: false,
      onlyAllowTrustedProviders: false
    });
    expect(tenant.urlKey).toMatch(/^[a-z0-9]{10}$/);
  });

  it('updates only the given settings and treats an unchanged update as a no-op', async () => {
    let { tenant: before } = await loadScope(org.ids.instanceId);
    let environmentCount = await subspaceDb.environment.count({
      where: { tenantOid: before.oid }
    });

    let updated = await updateTenant(before, {
      logRetentionInDays: 14,
      enforceSessionExpiry: true,
      messageProcessingTimeoutMs: before.messageProcessingTimeoutMs + 5_000
    });
    expect(updated).toMatchObject({
      id: before.id,
      urlKey: before.urlKey,
      logRetentionInDays: 14,
      enforceSessionExpiry: true,
      messageProcessingTimeoutMs: before.messageProcessingTimeoutMs + 5_000,
      dataRetentionLevel: before.dataRetentionLevel,
      collectErrors: before.collectErrors,
      storeToolCallAttachments: before.storeToolCallAttachments,
      disableCallbacks: before.disableCallbacks
    });

    let reloaded = await subspaceDb.tenant.findUniqueOrThrow({ where: { oid: before.oid } });
    expect(reloaded).toEqual(updated);

    let unchanged = await updateTenant(reloaded, {});
    expect(unchanged).toEqual(updated);
    expect(await subspaceDb.environment.count({ where: { tenantOid: before.oid } })).toBe(
      environmentCount
    );
  });

  it('renames environments in place and lets provisioning restore their names', async () => {
    let { tenant, environment } = await loadScope(org.ids.instanceId);
    let environmentCount = await subspaceDb.environment.count({
      where: { tenantOid: tenant.oid }
    });
    let name = uniqueId('Renamed environment');

    await updateTenant(tenant, {
      environments: [
        {
          name,
          identifier: environment.identifier,
          type: environment.type,
          resourceGroupId: environment.resourceGroupId!,
          resourceGroupIdentifier: environment.resourceGroupIdentifier!
        }
      ]
    });

    let renamed = await subspaceDb.environment.findUniqueOrThrow({
      where: { oid: environment.oid }
    });
    expect(renamed).toMatchObject({ id: environment.id, tenantOid: tenant.oid, name });
    expect(await subspaceDb.environment.count({ where: { tenantOid: tenant.oid } })).toBe(
      environmentCount
    );

    let resynced = await loadScope(org.ids.instanceId);
    expect(resynced.environment).toMatchObject({
      id: environment.id,
      name: environment.name
    });
  });

  it('resolves tenants and environments by id or identifier and rejects unknown ones', async () => {
    let { tenant, environment } = await loadScope(org.ids.instanceId);

    let byIdentifier = await tenantService.getTenantAndEnvironmentById({
      tenantId: tenant.identifier,
      environmentId: environment.identifier
    });
    expect(byIdentifier.tenant.id).toBe(tenant.id);
    expect(byIdentifier.environment.id).toBe(environment.id);

    await expectServiceError(
      tenantService.getTenantById({ id: uniqueId('ktn') }),
      'not_found'
    );
    await expectServiceError(
      tenantService.getTenantAndEnvironmentById({
        tenantId: tenant.id,
        environmentId: uniqueId('ken')
      }),
      'not_found'
    );
    await expectServiceError(
      tenantService.getTenantAndEnvironmentById({
        tenantId: uniqueId('ktn'),
        environmentId: environment.id
      }),
      'not_found'
    );
  });
});
