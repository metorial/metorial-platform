import { beforeEach, describe, expect, it } from 'vitest';
import {
  SlateTriggerDestinationStatus,
  SlateTriggerDestinationType
} from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateTriggerDestination:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns trigger destinations for a tenant', async () => {
    const { destination, tenant } = await f.slateTriggerDestination.withTenant();

    await f.slateTriggerDestination.default({ tenantOid: tenant.oid });

    const result = await slatesHubClient.slateTriggerDestination.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: destination.id,
      name: destination.name,
      description: destination.description,
      type: SlateTriggerDestinationType.http_endpoint,
      status: SlateTriggerDestinationStatus.active,
      url: destination.url,
      method: destination.method,
      eventTypes: destination.eventTypes,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date)
    });
  });
});

describe('slateTriggerDestination:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single trigger destination by ID', async () => {
    const { destination, tenant } = await f.slateTriggerDestination.withTenant();

    const result = await slatesHubClient.slateTriggerDestination.get({
      tenantId: tenant.id,
      slateTriggerDestinationId: destination.id
    });

    expect(result).toMatchObject({
      id: destination.id,
      name: destination.name,
      url: destination.url
    });
  });
});

describe('slateTriggerDestination:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple trigger destinations by IDs', async () => {
    const tenant = await f.tenant.default();
    const dest1 = await f.slateTriggerDestination.default({ tenantOid: tenant.oid });
    const dest2 = await f.slateTriggerDestination.default({ tenantOid: tenant.oid });

    const result = await slatesHubClient.slateTriggerDestination.getMany({
      tenantId: tenant.id,
      slateTriggerDestinationIds: [dest1.id, dest2.id]
    });

    expect(result).toMatchObject([{ id: dest1.id }, { id: dest2.id }]);
  });
});
