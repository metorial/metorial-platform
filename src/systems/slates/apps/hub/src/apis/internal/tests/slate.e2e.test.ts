import _ from 'lodash';
import { beforeEach, describe, expect, it } from 'vitest';
import { SlateStatus } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slate:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns active slates with nested data', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    const result = await slatesHubClient.slate.list({ limit: 10 });

    expect(result.items).toHaveLength(1);

    const [presented] = result.items;
    expect(presented).toBeDefined();

    expect(presented).toMatchObject({
      id: slate.id,
      identifier: slate.identifier,
      name: slate.name,
      registryId: slate.registry.id,
      currentVersion: {
        version: '1.0.0',
        specification: expect.anything()
      }
    });
  });

  it('filters out inactive slates', async () => {
    const registry = await f.registry.default();

    await f.slate.complete({
      slateStatus: SlateStatus.active,
      slateIdentifier: 'active-slate',
      slateOverrides: { registryOid: registry.oid }
    });

    await f.slate.complete({
      slateStatus: SlateStatus.inactive,
      slateIdentifier: 'inactive-slate',
      slateOverrides: { registryOid: registry.oid }
    });

    const result = await slatesHubClient.slate.list({ limit: 10 });

    expect(result).toMatchObject({
      items: [{ identifier: 'active-slate' }]
    });
  });

  it('returns paginated results with correct metadata', async () => {
    const registry = await f.registry.default();

    await Promise.all(
      _.times(10, i =>
        f.slate.complete({
          slateIdentifier: `slate-${i}`,
          slateStatus: SlateStatus.active,
          slateOverrides: { registryOid: registry.oid }
        })
      )
    );

    const firstPage = await slatesHubClient.slate.list({ limit: 4 });
    expect(firstPage.items).toHaveLength(4);
    expect(firstPage.pagination).toMatchObject({
      has_more_after: true
    });

    const lastItemId = firstPage?.items?.[firstPage.items.length - 1]?.id;
    const secondPage = await slatesHubClient.slate.list({
      limit: 4,
      after: lastItemId
    });
    expect(secondPage.items).toHaveLength(4);
    expect(secondPage.pagination).toMatchObject({
      has_more_after: true
    });

    const firstPageIds = firstPage.items.map((s: any) => s.id);
    const secondPageIds = secondPage.items.map((s: any) => s.id);
    const intersection = firstPageIds.filter(id => secondPageIds.includes(id));
    expect(intersection).toHaveLength(0);
  });

  it('presenter formats all fields correctly', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    const result = await slatesHubClient.slate.list({ limit: 10 });
    const presented = result.items[0];

    expect(presented).toMatchObject({
      id: slate.id,
      identifier: slate.identifier,
      name: slate.name,
      description: slate.description,
      registryId: slate.registry.id,
      scope: {
        registryId: slate.registry.id,
        id: slate.slateScopeIdOnRegistry,
        identifier: slate.slateScopeIdentifierOnRegistry
      },
      slate: {
        registryId: slate.registry.id,
        id: slate.slateIdOnRegistry,
        identifier: slate.slateIdentifierOnRegistry,
        fullIdentifier: slate.slateFullIdentifierOnRegistry
      },
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });
});

describe('slate:getStats E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns aggregated counts for a slate', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    await f.slateVersion.withSpecification({
      slateOid: slate.oid,
      registryOid: slate.registry.oid,
      version: '1.1.0'
    });

    const provider = await f.deploymentProvider.default();
    await f.slateDeployment.succeeded({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });

    await f.slateEvent.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid
    });

    await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid
    });

    const result = await slatesHubClient.slate.getStats({
      slateId: slate.id
    });

    expect(result).toMatchObject({
      slateId: slate.id,
      versions: 2,
      deployments: 1,
      discoveries: 1,
      events: 1
    });
  });
});
