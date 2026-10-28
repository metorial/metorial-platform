import { uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { describe, expect, it } from 'vitest';
import { providerCombinationService, publisherInternalService } from '../src';

describe('module-provider-internal', () => {
  let org = useOrganization();

  it('upserts a stable publisher for a tenant', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);
    let { tenant } = await resolveMetorialFacing({ instance });

    let publisher = await publisherInternalService.upsertPublisherForTenant({ tenant });
    expect(publisher.type).toBe('tenant');
    expect(publisher.identifier).toBe(`tenant::${tenant.id}`);
    expect(publisher.tenantOid).toBe(tenant.oid);

    let again = await publisherInternalService.upsertPublisherForTenant({ tenant });
    expect(again.id).toBe(publisher.id);
  });

  it('creates and updates an external publisher by identifier', async () => {
    let identifier = uniqueId('publisher');
    let name = uniqueId('Publisher');

    let publisher = await publisherInternalService.upsertPublisherForExternal({
      identifier,
      name,
      description: 'E2E publisher'
    });
    expect(publisher.type).toBe('external');
    expect(publisher.identifier).toBe(`ext::${identifier}`);
    expect(publisher.name).toBe(name);
    expect(publisher.tenantOid).toBeNull();

    let unchanged = await publisherInternalService.upsertPublisherForExternal({
      identifier,
      name,
      description: 'E2E publisher'
    });
    expect(unchanged.id).toBe(publisher.id);

    let renamed = await publisherInternalService.upsertPublisherForExternal({
      identifier,
      name: `${name}-renamed`,
      description: 'E2E publisher'
    });
    expect(renamed.id).toBe(publisher.id);
    expect(renamed.name).toBe(`${name}-renamed`);
  });

  it('resolves provider combinations only for valid inputs', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(
      await providerCombinationService.getCombinations({ instance, providers: [] })
    ).toEqual([]);
    await expect(
      providerCombinationService.getCombinations({ instance, providers: [{}] })
    ).rejects.toThrow(/provide at least/);
    await expect(
      providerCombinationService.getCombinations({
        instance,
        providers: [{ deploymentId: uniqueId('missing-deployment') }]
      })
    ).rejects.toThrow(/could not be found/);
    await expect(
      providerCombinationService.getCombinations({
        instance,
        providers: [{ deploymentId: uniqueId('a') }, { deploymentId: uniqueId('b') }],
        limit: 1
      })
    ).rejects.toThrow(/more than 1 providers/);
  });
});
