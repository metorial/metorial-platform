import { times } from 'lodash';
import { beforeEach, describe, expect, it } from 'vitest';
import { FunctionVersionStatus } from '../../../prisma/generated/client';
import { functionBayClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

describe('functionVersion:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns versions for a function', async () => {
    const baseVersion = await f.functionVersion.complete();
    const func = baseVersion.function;
    const runtime = baseVersion.runtime;

    const bundles = await Promise.all(
      times(4, () => f.functionBundle.available({ functionOid: func.oid }))
    );

    const versions = await Promise.all(
      times(bundles.length, index =>
        f.functionVersion.default({
          functionOid: func.oid,
          runtimeOid: runtime.oid,
          functionBundleOid: bundles[index]!.oid,
          overrides: {
            identifier: `v${index + 2}`,
            status: FunctionVersionStatus.active
          }
        })
      )
    );

    const versionIds = [baseVersion.id, ...versions.map(version => version.id)];

    const result = await functionBayClient.functionVersion.list({
      tenantId: func.tenant.id,
      functionId: func.id,
      limit: 10
    });

    expect(result.items.length).toBeGreaterThanOrEqual(2);
    result.items.forEach(item => {
      expect(versionIds).toContain(item.id);
      expect(item.function.id).toBe(func.id);
    });
    const [presented] = result.items;
    expect(presented).toBeDefined();
    expect(presented).toMatchObject({
      id: expect.any(String),
      identifier: expect.any(String),
      name: expect.any(String),
      function: {
        id: func.id
      },
      runtime: {
        id: runtime.id
      }
    });
  });
});

describe('functionVersion:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a version by ID', async () => {
    const version = await f.functionVersion.complete();

    const result = await functionBayClient.functionVersion.get({
      tenantId: version.function.tenant.id,
      functionId: version.function.id,
      functionVersionId: version.id
    });

    expect(result).toMatchObject({
      id: version.id,
      identifier: version.identifier,
      name: version.name
    });
  });
});
