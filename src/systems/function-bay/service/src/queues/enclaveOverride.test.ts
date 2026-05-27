import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getId, snowflake } from '../id';
import { fixtures } from '../test/fixtures';
import { cleanDatabase, testDb } from '../test/setup';

let providerMocks = vi.hoisted(() => ({
  cloneFunctionVersion: vi.fn()
}));

let storageMocks = vi.hoisted(() => ({
  getObject: vi.fn(),
  upsertBucket: vi.fn()
}));

vi.mock('../providers', () => ({
  getProvider: () => ({
    cloneFunctionVersion: providerMocks.cloneFunctionVersion
  })
}));

vi.mock('../storage', () => ({
  storage: storageMocks
}));

describe('enclave override clone queue', () => {
  let f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
    providerMocks.cloneFunctionVersion.mockReset();
    storageMocks.getObject.mockReset();
    storageMocks.upsertBucket.mockReset();
    storageMocks.getObject.mockResolvedValue({ data: Buffer.from('zip') });
    providerMocks.cloneFunctionVersion.mockResolvedValue({
      providerData: {
        functionArn: 'cloned-arn',
        functionName: 'cloned-function'
      }
    });
  });

  it('creates a clone function, clone version, and override without a deployment', async () => {
    let sourceVersion = await f.functionVersion.complete();
    let enclaveTenant = await f.tenant.default({ hasAutomaticEnclaveOverride: true });
    let enclave = await testDb.enclave.create({
      data: {
        ...getId('enclave'),
        identifier: 'customer-a',
        name: 'customer-a',
        tenantOid: enclaveTenant.oid
      }
    });

    let { processEnclaveOverrideClone } = await import('./enclaveOverride');
    await processEnclaveOverrideClone({
      enclaveId: enclave.id,
      functionId: sourceVersion.function.id,
      sourceFunctionVersionId: sourceVersion.id
    });

    let override = await testDb.enclaveFunctionOverride.findFirstOrThrow({
      where: {
        enclaveOid: enclave.oid,
        sourceFunctionOid: sourceVersion.function.oid,
        sourceFunctionVersionOid: sourceVersion.oid
      },
      include: {
        overrideFunction: true,
        overrideFunctionVersion: true
      }
    });

    expect(override.overrideFunction.tenantOid).toBe(enclaveTenant.oid);
    expect(override.overrideFunction.cloneOfFunctionOid).toBe(sourceVersion.function.oid);
    expect(override.overrideFunctionVersion.cloneOfFunctionVersionOid).toBe(sourceVersion.oid);
    expect(override.overrideFunctionVersion.providerData).toMatchObject({
      functionName: 'cloned-function'
    });
    await expect(testDb.functionDeployment.count()).resolves.toBe(0);
  });

  it('reuses the backing function from an existing override', async () => {
    let sourceVersion = await f.functionVersion.complete();
    let sourceBundle2 = await f.functionBundle.available({
      functionOid: sourceVersion.function.oid
    });
    let sourceVersion2 = await f.functionVersion.default({
      functionOid: sourceVersion.function.oid,
      runtimeOid: sourceVersion.runtimeOid,
      functionBundleOid: sourceBundle2.oid
    });
    let enclaveTenant = await f.tenant.default({ hasAutomaticEnclaveOverride: true });
    let enclave = await testDb.enclave.create({
      data: {
        ...getId('enclave'),
        identifier: 'customer-a',
        name: 'customer-a',
        tenantOid: enclaveTenant.oid
      }
    });
    let backingFunction = await f.function.default({
      tenantOid: enclaveTenant.oid,
      runtimeOid: sourceVersion.runtimeOid,
      overrides: {
        identifier: 'backing-function',
        cloneOfFunctionOid: sourceVersion.function.oid
      }
    });
    let unrelatedClone = await f.function.default({
      tenantOid: enclaveTenant.oid,
      runtimeOid: sourceVersion.runtimeOid,
      overrides: {
        identifier: 'unrelated-clone',
        cloneOfFunctionOid: sourceVersion.function.oid
      }
    });
    let backingBundle = await f.functionBundle.available({ functionOid: backingFunction.oid });
    let backingVersion = await f.functionVersion.default({
      functionOid: backingFunction.oid,
      runtimeOid: sourceVersion.runtimeOid,
      functionBundleOid: backingBundle.oid,
      overrides: { cloneOfFunctionVersionOid: sourceVersion.oid }
    });

    await testDb.enclaveFunctionOverride.create({
      data: {
        oid: snowflake.nextId(),
        enclaveOid: enclave.oid,
        sourceFunctionOid: sourceVersion.function.oid,
        sourceFunctionVersionOid: sourceVersion.oid,
        overrideFunctionOid: backingFunction.oid,
        overrideFunctionVersionOid: backingVersion.oid
      }
    });

    let { processEnclaveOverrideClone } = await import('./enclaveOverride');
    await processEnclaveOverrideClone({
      enclaveId: enclave.id,
      functionId: sourceVersion.function.id,
      sourceFunctionVersionId: sourceVersion2.id
    });

    let override = await testDb.enclaveFunctionOverride.findFirstOrThrow({
      where: {
        enclaveOid: enclave.oid,
        sourceFunctionOid: sourceVersion.function.oid,
        sourceFunctionVersionOid: sourceVersion2.oid
      }
    });

    expect(override.overrideFunctionOid).toBe(backingFunction.oid);
    expect(override.overrideFunctionOid).not.toBe(unrelatedClone.oid);
  });
});
