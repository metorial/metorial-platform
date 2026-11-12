import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { keyProviderErrorService } from '../src/services';
import { nebula } from './client';
import { createTenant } from './fixtures';

describe('nebula key providers', () => {
  it('uses the global default provider when a tenant has no explicit default', async () => {
    let tenant = await createTenant();
    expect(tenant.defaultKeyProviderId).toBeTruthy();

    let providers = await nebula.keyProvider.list({ tenantId: tenant.id, limit: 10 });

    expect(
      providers.items.some(
        provider =>
          provider.id === tenant.defaultKeyProviderId &&
          provider.owner === 'system' &&
          provider.isMetorialManaged
      )
    ).toBe(true);

    let fetched = await nebula.tenant.get({ tenantId: tenant.id });
    expect(fetched.defaultKeyProviderId).toBe(tenant.defaultKeyProviderId);
  });

  it('makes the first imported provider the explicit default', async () => {
    let tenant = await createTenant();

    let provider = await nebula.keyProvider.import({ tenantId: tenant.id, keyInput: {} });
    expect(provider.isMetorialManaged).toBe(false);

    let updated = await nebula.tenant.get({ tenantId: tenant.id });
    expect(updated.defaultKeyProviderId).toBe(provider.id);
    expect(updated.defaultKeyProviderId).not.toBe(tenant.defaultKeyProviderId);
  });

  it('makes the first managed provider the explicit default', async () => {
    let tenant = await createTenant();

    let provider = await nebula.keyProvider.createManaged({
      tenantId: tenant.id,
      name: 'Managed default'
    });
    expect(provider.isMetorialManaged).toBe(true);

    let updated = await nebula.tenant.get({ tenantId: tenant.id });
    expect(updated.defaultKeyProviderId).toBe(provider.id);
  });

  it('keeps an explicit default when another provider is created', async () => {
    let tenant = await createTenant();

    let first = await nebula.keyProvider.import({ tenantId: tenant.id, keyInput: {} });
    let second = await nebula.keyProvider.import({ tenantId: tenant.id, keyInput: {} });

    let updated = await nebula.tenant.get({ tenantId: tenant.id });
    expect(updated.defaultKeyProviderId).toBe(first.id);
    expect(updated.defaultKeyProviderId).not.toBe(second.id);
  });

  it('allows switching back to the global default provider', async () => {
    let tenant = await createTenant();
    let globalDefaultId = tenant.defaultKeyProviderId!;

    await nebula.keyProvider.import({ tenantId: tenant.id, keyInput: {} });
    await nebula.keyProvider.setDefault({
      tenantId: tenant.id,
      keyProviderId: globalDefaultId
    });

    let updated = await nebula.tenant.get({ tenantId: tenant.id });
    expect(updated.defaultKeyProviderId).toBe(globalDefaultId);
  });

  it('does not let a tenant set another tenant provider as its default', async () => {
    let tenantA = await createTenant();
    let tenantB = await createTenant();
    let provider = await nebula.keyProvider.import({ tenantId: tenantA.id, keyInput: {} });

    await expect(
      nebula.keyProvider.setDefault({ tenantId: tenantB.id, keyProviderId: provider.id })
    ).rejects.toThrow();

    let unchanged = await nebula.tenant.get({ tenantId: tenantB.id });
    expect(unchanged.defaultKeyProviderId).toBe(tenantB.defaultKeyProviderId);
  });

  it('returns local setup info', async () => {
    let tenant = await createTenant();

    let setupInfo = await nebula.keyProvider.getSetupInfo({ tenantId: tenant.id });

    expect(setupInfo).toMatchObject({ object: 'nebula#key_provider_setup_info' });
    expect(setupInfo.steps.length).toBeGreaterThan(0);
    expect(setupInfo.steps.some(step => step.markdown?.includes('keyProvider.import'))).toBe(
      true
    );
    expect(
      setupInfo.steps.some(step => step.inputs?.some(input => input.key === 'testKeyId'))
    ).toBe(true);
  });

  it('dedupes provider errors per day and increments the count', async () => {
    let tenant = await createTenant();
    let provider = await nebula.keyProvider.import({ tenantId: tenant.id, keyInput: {} });

    let dbTenant = await db.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    let dbProvider = await db.keyProvider.findUniqueOrThrow({ where: { id: provider.id } });

    for (let i = 0; i < 2; i++) {
      await keyProviderErrorService.recordKeyProviderError({
        tenant: dbTenant,
        keyProvider: dbProvider,
        operation: 'decrypt_data_key',
        code: 'DisabledException',
        message: 'KMS key is disabled'
      });
    }

    let errors = await db.keyError.findMany({ where: { tenantOid: dbTenant.oid } });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      count: 2,
      code: 'DisabledException',
      sampleMessage: 'KMS key is disabled'
    });
  });
});
