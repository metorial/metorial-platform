import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  FunctionDeployment,
  Function as FunctionModel,
  Runtime,
  FunctionBundle,
  Tenant,
  Provider
} from '../../../prisma/generated/client';
import { FunctionDeploymentStatus } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { FunctionFixtures } from './functionFixtures';
import { FunctionBundleFixtures } from './functionBundleFixtures';
import { Encryption } from '@lowerdeck/encryption';
import {
  resolveEncryptedEnvironmentVariables,
  withoutEncryptedEnvOverrides
} from './helpers';

const testEncryption = new Encryption(process.env.ENCRYPTION_KEY || 'test-encryption-key-32-bytes-key');

export const FunctionDeploymentFixtures = (db: PrismaClient) => {
  const functionFixtures = FunctionFixtures(db);
  const bundleFixtures = FunctionBundleFixtures(db);

  const defaultDeployment = async (data: {
    functionOid: bigint;
    runtimeOid: bigint;
    functionBundleOid?: bigint;
    overrides?: Partial<FunctionDeployment>;
  }): Promise<FunctionDeployment> => {
    const { oid, id } = getId('functionDeployment');
    const identifier =
      data.overrides?.identifier ?? `deploy-${randomBytes(4).toString('hex')}`;

    const encryptedEnv = await resolveEncryptedEnvironmentVariables({
      overrides: data.overrides,
      encryption: testEncryption,
      entityId: id
    });

    const factory = defineFactory<FunctionDeployment>(
      {
        oid,
        id,
        status: data.overrides?.status ?? FunctionDeploymentStatus.pending,
        identifier,
        name: data.overrides?.name ?? `Deployment ${identifier}`,
        functionOid: data.functionOid,
        runtimeOid: data.runtimeOid,
        functionBundleOid: data.functionBundleOid ?? null,
        functionVersionOid: data.overrides?.functionVersionOid ?? null,
        forgeRunId: data.overrides?.forgeRunId ?? null,
        forgeWorkflowId: data.overrides?.forgeWorkflowId ?? null,
        encryptedEnvironmentVariables: encryptedEnv,
        configuration: data.overrides?.configuration ?? {
          memorySizeMb: 256,
          timeoutSeconds: 30
        },
        errorCode: data.overrides?.errorCode ?? null,
        errorMessage: data.overrides?.errorMessage ?? null
      } as FunctionDeployment,
      {
        persist: value => db.functionDeployment.create({ data: value })
      }
    );

    return factory.create(withoutEncryptedEnvOverrides(data.overrides));
  };

  const pending = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    functionOverrides?: Partial<FunctionModel>;
    deploymentOverrides?: Partial<FunctionDeployment>;
  }): Promise<
    FunctionDeployment & {
      function: FunctionModel & { tenant: Tenant };
      runtime: Runtime & { provider: Provider };
    }
  > => {
    const func = await functionFixtures.withTenantAndRuntime({
      tenantOverrides: data?.tenantOverrides,
      functionOverrides: data?.functionOverrides
    });

    const deployment = await defaultDeployment({
      functionOid: func.oid,
      runtimeOid: func.runtime!.oid,
      overrides: {
        status: FunctionDeploymentStatus.pending,
        ...data?.deploymentOverrides
      }
    });

    return db.functionDeployment.findUniqueOrThrow({
      where: { oid: deployment.oid },
      include: {
        function: { include: { tenant: true } },
        runtime: { include: { provider: true } }
      }
    }) as Promise<
      FunctionDeployment & {
        function: FunctionModel & { tenant: Tenant };
        runtime: Runtime & { provider: Provider };
      }
    >;
  };

  const succeeded = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    functionOverrides?: Partial<FunctionModel>;
    deploymentOverrides?: Partial<FunctionDeployment>;
    bundleOverrides?: Partial<FunctionBundle>;
  }): Promise<
    FunctionDeployment & {
      function: FunctionModel & { tenant: Tenant };
      runtime: Runtime & { provider: Provider };
      functionBundle: FunctionBundle;
    }
  > => {
    const func = await functionFixtures.withTenantAndRuntime({
      tenantOverrides: data?.tenantOverrides,
      functionOverrides: data?.functionOverrides
    });

    const bundle = await bundleFixtures.available({
      functionOid: func.oid,
      overrides: data?.bundleOverrides
    });

    const deployment = await defaultDeployment({
      functionOid: func.oid,
      runtimeOid: func.runtime!.oid,
      functionBundleOid: bundle.oid,
      overrides: {
        status: FunctionDeploymentStatus.succeeded,
        ...data?.deploymentOverrides
      }
    });

    return db.functionDeployment.findUniqueOrThrow({
      where: { oid: deployment.oid },
      include: {
        function: { include: { tenant: true } },
        runtime: { include: { provider: true } },
        functionBundle: true
      }
    }) as Promise<
      FunctionDeployment & {
        function: FunctionModel & { tenant: Tenant };
        runtime: Runtime & { provider: Provider };
        functionBundle: FunctionBundle;
      }
    >;
  };

  const failed = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    functionOverrides?: Partial<FunctionModel>;
    deploymentOverrides?: Partial<FunctionDeployment>;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<
    FunctionDeployment & {
      function: FunctionModel & { tenant: Tenant };
      runtime: Runtime & { provider: Provider };
    }
  > => {
    const func = await functionFixtures.withTenantAndRuntime({
      tenantOverrides: data?.tenantOverrides,
      functionOverrides: data?.functionOverrides
    });

    const deployment = await defaultDeployment({
      functionOid: func.oid,
      runtimeOid: func.runtime!.oid,
      overrides: {
        status: FunctionDeploymentStatus.failed,
        errorCode: data?.errorCode ?? 'BUILD_FAILED',
        errorMessage: data?.errorMessage ?? 'Build process failed',
        ...data?.deploymentOverrides
      }
    });

    return db.functionDeployment.findUniqueOrThrow({
      where: { oid: deployment.oid },
      include: {
        function: { include: { tenant: true } },
        runtime: { include: { provider: true } }
      }
    }) as Promise<
      FunctionDeployment & {
        function: FunctionModel & { tenant: Tenant };
        runtime: Runtime & { provider: Provider };
      }
    >;
  };

  return {
    default: defaultDeployment,
    pending,
    succeeded,
    failed
  };
};
