import { uniqueId, useOrganization } from '@metorial/e2e';
import { subspaceDb } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { publisherInternalService } from '../src';
import { scopeOf } from './_fixtures';

let tick = () => new Promise(resolve => setTimeout(resolve, 20));

describe('module-provider-internal publishers', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('keeps one publisher per tenant that follows the tenant name', async () => {
    let [{ tenant }, { tenant: otherTenant }] = await Promise.all([
      scopeOf(org),
      scopeOf(otherOrg)
    ]);

    let publisher = await publisherInternalService.upsertPublisherForTenant({ tenant });
    let other = await publisherInternalService.upsertPublisherForTenant({
      tenant: otherTenant
    });
    expect(publisher).toMatchObject({
      type: 'tenant',
      identifier: `tenant::${tenant.id}`,
      name: tenant.name,
      tenantOid: tenant.oid,
      projectOid: tenant.projectOid
    });
    expect(other.id).not.toBe(publisher.id);
    expect(other.tenantOid).toBe(otherTenant.oid);

    let name = uniqueId('Renamed tenant');
    let renamed = await publisherInternalService.upsertPublisherForTenant({
      tenant: { ...tenant, name }
    });
    expect(renamed).toMatchObject({ id: publisher.id, name });

    let restored = await publisherInternalService.upsertPublisherForTenant({ tenant });
    expect(restored).toMatchObject({ id: publisher.id, name: tenant.name });
    expect(
      await subspaceDb.publisher.count({ where: { identifier: `tenant::${tenant.id}` } })
    ).toBe(1);
  });

  it('does not rewrite publishers whose input is unchanged', async () => {
    let { tenant } = await scopeOf(org);
    let upserts = [
      () => publisherInternalService.upsertPublisherForTenant({ tenant }),
      () => publisherInternalService.upsertPublisherForMetorial(),
      () => publisherInternalService.upsertUnknownPublisher(),
      () =>
        publisherInternalService.upsertPublisherForExternal({
          identifier: `e2e::${tenant.id}`,
          name: 'E2E external publisher'
        })
    ];

    for (let upsert of upserts) {
      let first = await upsert();
      await tick();
      let second = await upsert();

      expect(second.id).toBe(first.id);
      expect(second.updatedAt).toEqual(first.updatedAt);
    }
  });

  it('upserts the shared Metorial and unknown publishers without a tenant', async () => {
    let metorial = await publisherInternalService.upsertPublisherForMetorial();
    expect(metorial).toMatchObject({
      type: 'metorial',
      identifier: 'metorial',
      name: 'Metorial',
      tenantOid: null,
      projectOid: null,
      image: { type: 'url', url: expect.stringContaining('metorial') }
    });

    let unknown = await publisherInternalService.upsertUnknownPublisher();
    expect(unknown).toMatchObject({
      type: 'external',
      identifier: 'int::unknown',
      name: 'Unknown Publisher',
      tenantOid: null
    });
  });

  it('stores image changes of an external publisher', async () => {
    let identifier = uniqueId('image-publisher');
    let name = uniqueId('Image publisher');

    let created = await publisherInternalService.upsertPublisherForExternal({
      identifier,
      name,
      imageUrl: 'https://example.com/first.png'
    });
    expect(created.image).toEqual({ type: 'url', url: 'https://example.com/first.png' });

    let updated = await publisherInternalService.upsertPublisherForExternal({
      identifier,
      name,
      imageUrl: 'https://example.com/second.png'
    });
    expect(updated.id).toBe(created.id);
    expect(updated.image).toEqual({ type: 'url', url: 'https://example.com/second.png' });

    let row = await subspaceDb.publisher.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.image).toEqual({ type: 'url', url: 'https://example.com/second.png' });
  });
});
