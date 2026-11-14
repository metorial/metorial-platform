import { describe, expect, it } from 'vitest';
import { functionBay } from './client';
import { createRuntime, createTenant } from './fixtures';

describe('function-bay runtime', () => {
  it('gets a runtime by id and by identifier', async () => {
    let runtime = await createRuntime();

    for (let runtimeId of [runtime.id, runtime.identifier]) {
      let result = await functionBay.runtime.get({ runtimeId });
      expect(result).toMatchObject({
        id: runtime.id,
        identifier: runtime.identifier,
        name: runtime.name,
        createdAt: expect.any(Date)
      });
    }
  });

  it('rejects an unknown runtime', async () => {
    await expect(functionBay.runtime.get({ runtimeId: 'missing-runtime' })).rejects.toThrow();
  });

  it('lists runtimes with their provider', async () => {
    let tenant = await createTenant();
    let runtimes = await Promise.all([createRuntime(), createRuntime(), createRuntime()]);

    let result = await functionBay.runtime.list({ tenantId: tenant.id, limit: 100 });
    let ids = result.items.map(item => item.id);

    for (let runtime of runtimes) expect(ids).toContain(runtime.id);

    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      identifier: expect.any(String),
      provider: { id: expect.any(String), identifier: expect.any(String) }
    });
  });
});
