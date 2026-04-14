import { times } from 'lodash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { functionBayClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';

const providerMocks = vi.hoisted(() => ({
  invokeFunction: vi.fn()
}));

vi.mock('../../providers', () => ({
  getProvider: () => ({
    invokeFunction: providerMocks.invokeFunction
  })
}));

describe('function:upsert E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates a new function', async () => {
    const tenant = await f.tenant.default();

    const result = await functionBayClient.function.upsert({
      tenantId: tenant.id,
      identifier: 'my-function',
      name: 'My Function'
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      identifier: 'my-function',
      name: 'My Function',
      createdAt: expect.any(Date)
    });
  });

  it('updates existing function with same identifier', async () => {
    const tenant = await f.tenant.default();

    await functionBayClient.function.upsert({
      tenantId: tenant.id,
      identifier: 'existing-fn',
      name: 'Original Name'
    });

    const result = await functionBayClient.function.upsert({
      tenantId: tenant.id,
      identifier: 'existing-fn',
      name: 'Updated Name'
    });

    expect(result).toMatchObject({
      identifier: 'existing-fn',
      name: 'Updated Name'
    });
  });
});

describe('function:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns functions for a tenant', async () => {
    const tenant = await f.tenant.default();
    const otherTenant = await f.tenant.withIdentifier('other-tenant');

    const functions = await Promise.all(
      times(3, index =>
        f.function.default({
          tenantOid: tenant.oid,
          overrides: { identifier: `fn-${index + 1}` }
        })
      )
    );
    const otherFunction = await f.function.default({
      tenantOid: otherTenant.oid,
      overrides: { identifier: 'fn-other' }
    });

    const functionIds = functions.map(func => func.id);

    const result = await functionBayClient.function.list({
      tenantId: tenant.id,
      limit: 10
    });

    expect(result.items).toHaveLength(3);
    result.items.forEach(item => {
      expect(functionIds).toContain(item.id);
    });
    const [presented] = result.items;
    expect(presented).toBeDefined();
    expect(presented).toMatchObject({
      id: expect.any(String),
      identifier: expect.any(String),
      name: expect.any(String),
      createdAt: expect.any(Date)
    });
    expect(result.items.map(item => item.id)).not.toContain(otherFunction.id);
  });
});

describe('function:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a function by ID', async () => {
    const func = await f.function.withTenant();

    const result = await functionBayClient.function.get({
      tenantId: func.tenant.id,
      functionId: func.id
    });

    expect(result).toMatchObject({
      id: func.id,
      identifier: func.identifier,
      name: func.name
    });
  });
});

describe('function:update E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('updates function name', async () => {
    const func = await f.function.withTenant();

    const result = await functionBayClient.function.update({
      tenantId: func.tenant.id,
      functionId: func.id,
      name: 'Updated Function Name'
    });

    expect(result).toMatchObject({
      id: func.id,
      name: 'Updated Function Name'
    });
  });
});

describe('function:invoke E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
    providerMocks.invokeFunction.mockReset();
  });

  it('invokes the current function version', async () => {
    const version = await f.functionVersion.complete();

    providerMocks.invokeFunction.mockResolvedValue({
      type: 'success',
      result: { ok: true },
      logs: [],
      computeTimeMs: 10,
      billedTimeMs: 10
    });

    const result = await functionBayClient.function.invoke({
      tenantId: version.function.tenant.id,
      functionId: version.function.id,
      payload: { input: 'test' }
    });

    expect(result).toMatchObject({
      type: 'success',
      result: { ok: true },
      id: expect.any(String)
    });
    expect(providerMocks.invokeFunction).toHaveBeenCalledOnce();
  });

  it('returns error when function has no deployed versions', async () => {
    const func = await f.function.withTenant();

    await expect(
      functionBayClient.function.invoke({
        tenantId: func.tenant.id,
        functionId: func.id,
        payload: { input: 'test' }
      })
    ).rejects.toThrow('Function has no versions deployed');
    expect(providerMocks.invokeFunction).not.toHaveBeenCalled();
  });
});
