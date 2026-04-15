import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  FunctionVersion,
  Function as FunctionModel,
  Runtime,
  FunctionBundle,
  Tenant,
  Provider
} from '../../../prisma/generated/client';
import { FunctionVersionStatus } from '../../../prisma/generated/client';
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

export const FunctionVersionFixtures = (db: PrismaClient) => {
  const functionFixtures = FunctionFixtures(db);
  const bundleFixtures = FunctionBundleFixtures(db);

  const defaultVersion = async (data: {
    functionOid: bigint;
    runtimeOid: bigint;
    functionBundleOid: bigint;
    overrides?: Partial<FunctionVersion>;
  }): Promise<FunctionVersion> => {
    const { oid, id } = getId('functionVersion');
    const identifier =
      data.overrides?.identifier ?? `v${randomBytes(2).toString('hex')}`;

    const encryptedEnv = await resolveEncryptedEnvironmentVariables({
      overrides: data.overrides,
      encryption: testEncryption,
      entityId: id
    });

    const factory = defineFactory<FunctionVersion>(
      {
        oid,
        id,
        status: data.overrides?.status ?? FunctionVersionStatus.active,
        identifier,
        name: data.overrides?.name ?? `Version ${identifier}`,
        functionOid: data.functionOid,
        runtimeOid: data.runtimeOid,
        functionBundleOid: data.functionBundleOid,
        encryptedEnvironmentVariables: encryptedEnv,
        configuration: data.overrides?.configuration ?? {
          memorySizeMb: 256,
          timeoutSeconds: 30
        },
        providerData: data.overrides?.providerData ?? {
          functionArn: `arn:aws:lambda:us-east-1:123456789:function:test-${identifier}`,
          versionArn: `arn:aws:lambda:us-east-1:123456789:function:test-${identifier}:1`
        },
        manifest: data.overrides?.manifest ?? {
          entrypoint: 'index.handler',
          files: ['index.js']
        }
      } as FunctionVersion,
      {
        persist: value => db.functionVersion.create({ data: value })
      }
    );

    return factory.create(withoutEncryptedEnvOverrides(data.overrides));
  };

  const complete = async (data?: {
    tenantOverrides?: Partial<Tenant>;
    functionOverrides?: Partial<FunctionModel>;
    versionOverrides?: Partial<FunctionVersion>;
    bundleOverrides?: Partial<FunctionBundle>;
  }): Promise<
    FunctionVersion & {
      function: FunctionModel & { tenant: Tenant; runtime: Runtime & { provider: Provider } };
      runtime: Runtime;
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

    const version = await defaultVersion({
      functionOid: func.oid,
      runtimeOid: func.runtime!.oid,
      functionBundleOid: bundle.oid,
      overrides: data?.versionOverrides
    });

    await db.function.update({
      where: { oid: func.oid },
      data: { currentVersionOid: version.oid }
    });

    return db.functionVersion.findUniqueOrThrow({
      where: { oid: version.oid },
      include: {
        function: {
          include: {
            tenant: true,
            runtime: { include: { provider: true } }
          }
        },
        runtime: true,
        functionBundle: true
      }
    }) as Promise<
      FunctionVersion & {
        function: FunctionModel & { tenant: Tenant; runtime: Runtime & { provider: Provider } };
        runtime: Runtime;
        functionBundle: FunctionBundle;
      }
    >;
  };

  return {
    default: defaultVersion,
    complete
  };
};
