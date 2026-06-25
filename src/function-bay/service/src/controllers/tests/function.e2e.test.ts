import { times } from 'lodash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { functionBayClient } from '../../test/client';
import { fixtures } from '../../test/fixtures';
import { cleanDatabase, testDb } from '../../test/setup';
import { getId, snowflake } from '../../id';

const providerMocks = vi.hoisted(() => ({
  invokeFunction: vi.fn()
}));

const queueMocks = vi.hoisted(() => ({
  enqueueEnclaveOverrideClone: vi.fn()
}));

vi.mock('../../providers', () => ({
  getProvider: () => ({
    invokeFunction: providerMocks.invokeFunction
  })
}));

vi.mock('../../queues/enclaveOverride', () => ({
  enqueueEnclaveOverrideClone: queueMocks.enqueueEnclaveOverrideClone
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
    queueMocks.enqueueEnclaveOverrideClone.mockReset();
  });

  it('invokes the current function version', async () => {
    const version = await f.functionVersion.complete();

    providerMocks.invokeFunction.mockResolvedValue({
      type: 'success',
      result: { ok: true },
      logs: [[1_700_000_000_000, 'hello']],
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
      status: 'succeeded',
      result: { ok: true },
      error: null,
      id: expect.any(String),
      functionVersionId: version.id,
      computeTimeMs: 10,
      billedTimeMs: 10,
      logs: [{ timestamp: 1_700_000_000_000, message: 'hello' }]
    });
    expect(providerMocks.invokeFunction).toHaveBeenCalledOnce();
  });

  it('lazily creates an enclave link and routes to the original version while override is disabled', async () => {
    const sourceVersion = await f.functionVersion.complete();
    const enclaveTenant = await f.tenant.default();

    providerMocks.invokeFunction.mockResolvedValue({
      type: 'success',
      result: { ok: true },
      logs: [],
      computeTimeMs: 10,
      billedTimeMs: 10
    });

    const result = await functionBayClient.function.invoke({
      tenantId: enclaveTenant.id,
      functionTenantId: sourceVersion.function.tenant.id,
      functionId: sourceVersion.function.id,
      payload: { input: 'test' },
      enclave: {
        identifier: 'customer-a'
      }
    });

    expect(result.functionVersionId).toBe(sourceVersion.id);
    expect(queueMocks.enqueueEnclaveOverrideClone).not.toHaveBeenCalled();
    expect(providerMocks.invokeFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        function: expect.objectContaining({ id: sourceVersion.function.id }),
        functionVersion: expect.objectContaining({ id: sourceVersion.id })
      })
    );

    const enclave = await testDb.enclave.findFirstOrThrow({
      where: { identifier: 'customer-a', tenantOid: enclaveTenant.oid }
    });
    await expect(
      testDb.enclaveFunction.findFirstOrThrow({
        where: {
          enclaveOid: enclave.oid,
          functionOid: sourceVersion.function.oid
        }
      })
    ).resolves.toBeDefined();
  });

  it('schedules an enclave override clone when automatic overrides are enabled', async () => {
    const sourceVersion = await f.functionVersion.complete();
    const enclaveTenant = await f.tenant.default({
      hasAutomaticEnclaveOverride: true
    });

    providerMocks.invokeFunction.mockResolvedValue({
      type: 'success',
      result: { ok: true },
      logs: [],
      computeTimeMs: 10,
      billedTimeMs: 10
    });

    const result = await functionBayClient.function.invoke({
      tenantId: enclaveTenant.id,
      functionTenantId: sourceVersion.function.tenant.id,
      functionId: sourceVersion.function.id,
      payload: { input: 'test' },
      enclave: {
        identifier: 'customer-a'
      }
    });

    expect(result.functionVersionId).toBe(sourceVersion.id);
    expect(queueMocks.enqueueEnclaveOverrideClone).toHaveBeenCalledWith({
      enclaveId: expect.any(String),
      functionId: sourceVersion.function.id,
      sourceFunctionVersionId: sourceVersion.id
    });
  });

  it('routes enclave invocations to an existing override version', async () => {
    const sourceVersion = await f.functionVersion.complete();
    const enclaveTenant = await f.tenant.default({
      hasAutomaticEnclaveOverride: true
    });
    const enclaveIds = getId('enclave');
    const cloneFunction = await f.function.default({
      tenantOid: enclaveTenant.oid,
      runtimeOid: sourceVersion.runtimeOid,
      overrides: {
        cloneOfFunctionOid: sourceVersion.function.oid
      }
    });
    const cloneBundle = await f.functionBundle.available({
      functionOid: cloneFunction.oid
    });
    const cloneVersion = await f.functionVersion.default({
      functionOid: cloneFunction.oid,
      runtimeOid: sourceVersion.runtimeOid,
      functionBundleOid: cloneBundle.oid,
      overrides: {
        cloneOfFunctionVersionOid: sourceVersion.oid,
        providerData: {
          functionArn: 'override-arn',
          functionName: 'override-function'
        }
      }
    });

    const enclave = await testDb.enclave.create({
      data: {
        ...enclaveIds,
        identifier: 'customer-a',
        name: 'customer-a',
        tenantOid: enclaveTenant.oid
      }
    });
    await testDb.enclaveFunction.create({
      data: {
        oid: snowflake.nextId(),
        enclaveOid: enclave.oid,
        functionOid: sourceVersion.function.oid
      }
    });
    await testDb.enclaveFunctionOverride.create({
      data: {
        oid: snowflake.nextId(),
        enclaveOid: enclave.oid,
        sourceFunctionOid: sourceVersion.function.oid,
        sourceFunctionVersionOid: sourceVersion.oid,
        overrideFunctionOid: cloneFunction.oid,
        overrideFunctionVersionOid: cloneVersion.oid
      }
    });

    providerMocks.invokeFunction.mockResolvedValue({
      type: 'success',
      result: { ok: true },
      logs: [],
      computeTimeMs: 10,
      billedTimeMs: 10
    });

    const result = await functionBayClient.function.invoke({
      tenantId: enclaveTenant.id,
      functionTenantId: sourceVersion.function.tenant.id,
      functionId: sourceVersion.function.id,
      payload: { input: 'test' },
      enclave: {
        identifier: 'customer-a'
      }
    });

    expect(result.functionVersionId).toBe(cloneVersion.id);
    expect(queueMocks.enqueueEnclaveOverrideClone).not.toHaveBeenCalled();
    expect(providerMocks.invokeFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        function: expect.objectContaining({ id: cloneFunction.id }),
        functionVersion: expect.objectContaining({ id: cloneVersion.id }),
        providerData: expect.objectContaining({ functionName: 'override-function' })
      })
    );
  });

  it('supports invoking a shared function through a tenant-scoped runtime context', async () => {
    const version = await f.functionVersion.complete();
    const runtimeTenant = await f.tenant.withIdentifier('runtime-tenant');
    const egressPolicy = {
      direction: 'egress' as const,
      entries: [
        {
          cidr: '203.0.113.10/32',
          portRange: { from: 443, to: 443 }
        }
      ]
    };

    providerMocks.invokeFunction.mockResolvedValue({
      type: 'success',
      result: { ok: true },
      logs: [],
      computeTimeMs: 10,
      billedTimeMs: 10
    });

    await functionBayClient.function.invoke({
      tenantId: runtimeTenant.id,
      functionTenantId: version.function.tenant.id,
      functionId: version.function.id,
      payload: { input: 'test' },
      egressPolicy
    });

    expect(providerMocks.invokeFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: runtimeTenant.id,
        function: expect.objectContaining({ id: version.function.id }),
        functionVersion: expect.objectContaining({ id: version.id }),
        egressPolicy
      })
    );
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
