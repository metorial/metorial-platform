import { beforeEach, describe, expect, it } from 'vitest';
import { nebulaClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('key provider defaults', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns the global default provider when a tenant has no explicit default', async () => {
    let tenant = await nebulaClient.tenant.upsert({
      identifier: 'tenant-default',
      name: 'Tenant Default'
    });

    expect(tenant.defaultKeyProviderId).toBeTruthy();

    let keyProviders = await nebulaClient.keyProvider.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(
      keyProviders.items.some(
        keyProvider =>
          keyProvider.id === tenant.defaultKeyProviderId &&
          keyProvider.owner === 'system' &&
          keyProvider.isMetorialManaged
      )
    ).toBe(true);

    let fetchedTenant = await nebulaClient.tenant.get({ tenantId: tenant.id });
    expect(fetchedTenant.defaultKeyProviderId).toBe(tenant.defaultKeyProviderId);
  });

  it('sets the first imported provider as the explicit default', async () => {
    let tenant = await nebulaClient.tenant.upsert({
      identifier: 'tenant-import-default',
      name: 'Tenant Import Default'
    });
    let globalDefaultId = tenant.defaultKeyProviderId;

    let provider = await nebulaClient.keyProvider.import({
      tenantId: tenant.id,
      keyInput: {}
    });
    expect(provider.isMetorialManaged).toBe(false);

    let updatedTenant = await nebulaClient.tenant.get({ tenantId: tenant.id });
    expect(updatedTenant.defaultKeyProviderId).toBe(provider.id);
    expect(updatedTenant.defaultKeyProviderId).not.toBe(globalDefaultId);
  });

  it('allows the global default provider to be set explicitly', async () => {
    let tenant = await nebulaClient.tenant.upsert({
      identifier: 'tenant-global-explicit-default',
      name: 'Tenant Global Explicit Default'
    });
    let globalDefaultId = tenant.defaultKeyProviderId!;

    await nebulaClient.keyProvider.import({
      tenantId: tenant.id,
      keyInput: {}
    });

    await nebulaClient.keyProvider.setDefault({
      tenantId: tenant.id,
      keyProviderId: globalDefaultId
    });

    let updatedTenant = await nebulaClient.tenant.get({ tenantId: tenant.id });
    expect(updatedTenant.defaultKeyProviderId).toBe(globalDefaultId);
  });

  it('sets the first managed provider as the explicit default', async () => {
    let tenant = await nebulaClient.tenant.upsert({
      identifier: 'tenant-managed-default',
      name: 'Tenant Managed Default'
    });

    let provider = await nebulaClient.keyProvider.createManaged({
      tenantId: tenant.id,
      name: 'Managed default'
    });
    expect(provider.isMetorialManaged).toBe(true);

    let updatedTenant = await nebulaClient.tenant.get({ tenantId: tenant.id });
    expect(updatedTenant.defaultKeyProviderId).toBe(provider.id);
  });

  it('does not replace an explicit default when another provider is created', async () => {
    let tenant = await nebulaClient.tenant.upsert({
      identifier: 'tenant-default-preserved',
      name: 'Tenant Default Preserved'
    });

    let firstProvider = await nebulaClient.keyProvider.import({
      tenantId: tenant.id,
      keyInput: {}
    });
    let secondProvider = await nebulaClient.keyProvider.import({
      tenantId: tenant.id,
      keyInput: {}
    });

    let updatedTenant = await nebulaClient.tenant.get({ tenantId: tenant.id });
    expect(updatedTenant.defaultKeyProviderId).toBe(firstProvider.id);
    expect(updatedTenant.defaultKeyProviderId).not.toBe(secondProvider.id);
  });
});
