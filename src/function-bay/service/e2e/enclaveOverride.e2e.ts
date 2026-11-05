import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uniqueId } from '@lowerdeck/testing-tools';
import { db as testDb } from '../src/db';
import { getId, snowflake } from '../src/id';
import {
  createBundle,
  createDeployment,
  createFunction,
  createFunctionWithVersion,
  createTenant,
  createVersion
} from './fixtures';

let providerMocks = vi.hoisted(() => ({
  cloneFunctionVersion: vi.fn()
}));

let storageMocks = vi.hoisted(() => ({
  getObject: vi.fn(),
  upsertBucket: vi.fn()
}));

vi.mock('../src/providers', () => ({
  getProvider: () => ({
    cloneFunctionVersion: providerMocks.cloneFunctionVersion
  })
}));

vi.mock('../src/storage', () => ({
  storage: storageMocks
}));

describe('function-bay enclave override clone queue', () => {
  beforeEach(async () => {
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
    let seeded = await createFunctionWithVersion();
    let sourceVersion = { ...seeded.version, function: seeded.function };
    let enclaveTenant = await createTenant({ hasAutomaticEnclaveOverride: true });
    let enclave = await testDb.enclave.create({
      data: {
        ...getId('enclave'),
        identifier: uniqueId('enclave'),
        name: 'customer-a',
        tenantOid: enclaveTenant.oid
      }
    });

    let { processEnclaveOverrideClone } = await import('../src/queues/enclaveOverride');
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
    expect(override.overrideFunctionVersion.supportsV2Proxy).toBe(true);
    await expect(
      testDb.enclaveFunctionOverrideDeployment.findFirstOrThrow({
        where: {
          enclaveOid: enclave.oid,
          sourceFunctionOid: sourceVersion.function.oid,
          sourceFunctionVersionOid: sourceVersion.oid
        }
      })
    ).resolves.toMatchObject({
      status: 'succeeded',
      overrideFunctionOid: override.overrideFunctionOid,
      overrideFunctionVersionOid: override.overrideFunctionVersionOid,
      enclaveFunctionOverrideOid: override.oid,
      errorMessage: null
    });
    await expect(
      testDb.functionDeployment.count({ where: { functionOid: sourceVersion.function.oid } })
    ).resolves.toBe(0);
  });

  it('decrypts source env vars from the deployment for versions with legacy ciphertext', async () => {
    let seeded = await createFunctionWithVersion();
    let sourceVersion = { ...seeded.version, function: seeded.function };
    let deployment = await createDeployment({
      functionOid: sourceVersion.function.oid,
      runtimeOid: sourceVersion.runtimeOid,
      overrides: {
        functionBundleOid: sourceVersion.functionBundleOid,
        functionVersionOid: sourceVersion.oid
      }
    });
    await testDb.functionVersion.update({
      where: { oid: sourceVersion.oid },
      data: { encryptedEnvironmentVariables: deployment.encryptedEnvironmentVariables }
    });

    let enclaveTenant = await createTenant({ hasAutomaticEnclaveOverride: true });
    let enclave = await testDb.enclave.create({
      data: {
        ...getId('enclave'),
        identifier: uniqueId('enclave'),
        name: 'customer-a',
        tenantOid: enclaveTenant.oid
      }
    });

    let { processEnclaveOverrideClone } = await import('../src/queues/enclaveOverride');
    await processEnclaveOverrideClone({
      enclaveId: enclave.id,
      functionId: sourceVersion.function.id,
      sourceFunctionVersionId: sourceVersion.id
    });

    expect(providerMocks.cloneFunctionVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        env: {}
      })
    );
  });

  it('reuses the backing function from an existing override', async () => {
    let seeded = await createFunctionWithVersion();
    let sourceVersion = { ...seeded.version, function: seeded.function };
    let sourceBundle2 = await createBundle({ functionOid: sourceVersion.function.oid });
    let sourceVersion2 = await createVersion({
      functionOid: sourceVersion.function.oid,
      runtimeOid: sourceVersion.runtimeOid,
      functionBundleOid: sourceBundle2.oid
    });
    let enclaveTenant = await createTenant({ hasAutomaticEnclaveOverride: true });
    let enclave = await testDb.enclave.create({
      data: {
        ...getId('enclave'),
        identifier: uniqueId('enclave'),
        name: 'customer-a',
        tenantOid: enclaveTenant.oid
      }
    });
    let backingFunction = await createFunction({
      tenantOid: enclaveTenant.oid,
      runtimeOid: sourceVersion.runtimeOid,
      overrides: {
        identifier: uniqueId('backing'),
        cloneOfFunctionOid: sourceVersion.function.oid
      }
    });
    let unrelatedClone = await createFunction({
      tenantOid: enclaveTenant.oid,
      runtimeOid: sourceVersion.runtimeOid,
      overrides: {
        identifier: uniqueId('unrelated'),
        cloneOfFunctionOid: sourceVersion.function.oid
      }
    });
    let backingBundle = await createBundle({ functionOid: backingFunction.oid });
    let backingVersion = await createVersion({
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

    let { processEnclaveOverrideClone } = await import('../src/queues/enclaveOverride');
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

  it('marks the override deployment as failed when cloning fails', async () => {
    providerMocks.cloneFunctionVersion.mockRejectedValueOnce(new Error('provider failed'));
    let seeded = await createFunctionWithVersion();
    let sourceVersion = { ...seeded.version, function: seeded.function };
    let enclaveTenant = await createTenant({ hasAutomaticEnclaveOverride: true });
    let enclave = await testDb.enclave.create({
      data: {
        ...getId('enclave'),
        identifier: uniqueId('enclave'),
        name: 'customer-a',
        tenantOid: enclaveTenant.oid
      }
    });

    let { processEnclaveOverrideClone } = await import('../src/queues/enclaveOverride');
    await expect(
      processEnclaveOverrideClone({
        enclaveId: enclave.id,
        functionId: sourceVersion.function.id,
        sourceFunctionVersionId: sourceVersion.id
      })
    ).rejects.toThrow('provider failed');

    await expect(
      testDb.enclaveFunctionOverrideDeployment.findFirstOrThrow({
        where: {
          enclaveOid: enclave.oid,
          sourceFunctionOid: sourceVersion.function.oid,
          sourceFunctionVersionOid: sourceVersion.oid
        }
      })
    ).resolves.toMatchObject({
      status: 'failed',
      errorMessage: 'provider failed',
      overrideFunctionVersionOid: null,
      enclaveFunctionOverrideOid: null
    });
  });

  it('marks corrupt source bundles as failed without retrying the queue', async () => {
    providerMocks.cloneFunctionVersion.mockRejectedValueOnce(
      new Error("Corrupted zip: can't find end of central directory")
    );
    let seeded = await createFunctionWithVersion();
    let sourceVersion = { ...seeded.version, function: seeded.function };
    let enclaveTenant = await createTenant({ hasAutomaticEnclaveOverride: true });
    let enclave = await testDb.enclave.create({
      data: {
        ...getId('enclave'),
        identifier: uniqueId('enclave'),
        name: 'customer-a',
        tenantOid: enclaveTenant.oid
      }
    });

    let { processEnclaveOverrideClone } = await import('../src/queues/enclaveOverride');
    await expect(
      processEnclaveOverrideClone({
        enclaveId: enclave.id,
        functionId: sourceVersion.function.id,
        sourceFunctionVersionId: sourceVersion.id
      })
    ).resolves.toBeUndefined();

    await expect(
      testDb.enclaveFunctionOverrideDeployment.findFirstOrThrow({
        where: {
          enclaveOid: enclave.oid,
          sourceFunctionOid: sourceVersion.function.oid,
          sourceFunctionVersionOid: sourceVersion.oid
        }
      })
    ).resolves.toMatchObject({
      status: 'failed',
      errorMessage: "Corrupted zip: can't find end of central directory"
    });
    await expect(
      testDb.functionBundle.findUniqueOrThrow({
        where: { oid: sourceVersion.functionBundleOid }
      })
    ).resolves.toMatchObject({ status: 'failed' });
  });
});
