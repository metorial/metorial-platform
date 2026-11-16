import { describe, expect, it } from 'vitest';
import { functionBay } from './client';
import { createBundle, createFunctionWithVersion, createVersion } from './fixtures';

describe('function-bay function version', () => {
  it('lists the versions of a function', async () => {
    let seeded = await createFunctionWithVersion();
    let extra = await Promise.all(
      [0, 1, 2].map(async () =>
        createVersion({
          functionOid: seeded.function.oid,
          runtimeOid: seeded.runtime.oid,
          functionBundleOid: (await createBundle({ functionOid: seeded.function.oid })).oid
        })
      )
    );

    let result = await functionBay.functionVersion.list({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
      limit: 10
    });

    let ids = result.items.map(item => item.id);
    expect(ids).toHaveLength(4);
    for (let version of [seeded.version, ...extra]) expect(ids).toContain(version.id);

    expect(result.items[0]).toMatchObject({
      function: { id: seeded.function.id },
      runtime: { id: seeded.runtime.id }
    });
  });

  it('does not list versions of another tenant function', async () => {
    let seeded = await createFunctionWithVersion();
    let other = await createFunctionWithVersion();

    await expect(
      functionBay.functionVersion.list({
        tenantId: other.tenant.id,
        functionId: seeded.function.id,
        limit: 10
      })
    ).rejects.toThrow();
  });

  it('gets a version by id', async () => {
    let seeded = await createFunctionWithVersion();

    let result = await functionBay.functionVersion.get({
      tenantId: seeded.tenant.id,
      functionId: seeded.function.id,
      functionVersionId: seeded.version.id
    });

    expect(result).toMatchObject({
      id: seeded.version.id,
      identifier: seeded.version.identifier,
      name: seeded.version.name
    });
  });
});
