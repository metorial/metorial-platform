import { times } from 'lodash';
import { beforeEach, describe, expect, it } from 'vitest';
import { functionBayClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

describe('runtime:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a runtime by ID', async () => {
    const runtime = await f.runtime.nodejs22();

    const result = await functionBayClient.runtime.get({
      runtimeId: runtime.id
    });

    expect(result).toMatchObject({
      id: runtime.id,
      identifier: runtime.identifier,
      name: runtime.name,
      createdAt: expect.any(Date)
    });
  });
});

describe('runtime:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns runtimes', async () => {
    const tenant = await f.tenant.default();
    const provider = await f.provider.awsLambda();

    const runtimes = await Promise.all(
      times(5, index =>
        f.runtime.default({
          providerOid: provider.oid,
          overrides: { identifier: `rt-${index + 1}` }
        })
      )
    );

    const runtimeIds = runtimes.map(runtime => runtime.id);

    const result = await functionBayClient.runtime.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items.length).toBeGreaterThanOrEqual(5);
    result.items.forEach(item => {
      expect(runtimeIds).toContain(item.id);
    });
    const [presented] = result.items;
    expect(presented).toBeDefined();
    expect(presented).toMatchObject({
      id: expect.any(String),
      identifier: expect.any(String),
      name: expect.any(String),
      provider: {
        id: expect.any(String),
        identifier: expect.any(String),
        name: expect.any(String)
      }
    });
  });
});
