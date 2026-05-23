import { defineFactory } from '@mtsrc/testing-tools';
import { randomBytes } from 'crypto';
import type { PrismaClient, Provider, Runtime } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { ProviderFixtures } from './providerFixtures';

export const RuntimeFixtures = (db: PrismaClient) => {
  const providerFixtures = ProviderFixtures(db);

  const defaultRuntime = async (data: {
    providerOid: bigint;
    overrides?: Partial<Runtime>;
  }): Promise<Runtime> => {
    const { oid, id } = getId('runtime');
    const identifier =
      data.overrides?.identifier ?? `test-runtime-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Runtime>(
      {
        oid,
        id,
        identifier,
        name: data.overrides?.name ?? `Test Runtime ${identifier}`,
        providerOid: data.providerOid,
        configuration: data.overrides?.configuration ?? {
          runtime: { identifier: 'nodejs', version: '22.x' },
          layer: {
            provider: 'aws.lambda',
            identifier: 'test-layer',
            version: '2026-01-01',
            os: 'linux',
            osIdentifier: 'aws-linux.any',
            arch: 'x86_64'
          }
        }
      } as Runtime,
      {
        persist: value => db.runtime.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const withProvider = async (data?: {
    providerOverrides?: Partial<Provider>;
    runtimeOverrides?: Partial<Runtime>;
  }): Promise<Runtime & { provider: Provider }> => {
    const provider = await providerFixtures.awsLambda(data?.providerOverrides);

    const runtime = await defaultRuntime({
      providerOid: provider.oid,
      overrides: data?.runtimeOverrides
    });

    return db.runtime.findUniqueOrThrow({
      where: { id: runtime.id },
      include: { provider: true }
    }) as Promise<Runtime & { provider: Provider }>;
  };

  const withLocalProvider = async (data?: {
    providerOverrides?: Partial<Provider>;
    runtimeOverrides?: Partial<Runtime>;
  }): Promise<Runtime & { provider: Provider }> => {
    const provider = await providerFixtures.local(data?.providerOverrides);

    const runtime = await defaultRuntime({
      providerOid: provider.oid,
      overrides: data?.runtimeOverrides
    });

    return db.runtime.findUniqueOrThrow({
      where: { id: runtime.id },
      include: { provider: true }
    }) as Promise<Runtime & { provider: Provider }>;
  };

  const nodejs22 = async (data?: {
    providerOverrides?: Partial<Provider>;
    runtimeOverrides?: Partial<Runtime>;
  }): Promise<Runtime & { provider: Provider }> =>
    withProvider({
      providerOverrides: data?.providerOverrides,
      runtimeOverrides: {
        identifier: 'aws.lambda.nodejs22.x',
        name: 'AWS Lambda Node.js 22.x',
        configuration: {
          runtime: { identifier: 'nodejs', version: '22.x' },
          layer: {
            provider: 'aws.lambda',
            identifier: 'aws-layer-nodejs22',
            version: '2026-01-01',
            os: 'linux',
            osIdentifier: 'aws-linux.any',
            arch: 'x86_64'
          }
        },
        ...data?.runtimeOverrides
      }
    });

  const localNodejs22 = async (data?: {
    providerOverrides?: Partial<Provider>;
    runtimeOverrides?: Partial<Runtime>;
  }): Promise<Runtime & { provider: Provider }> =>
    withLocalProvider({
      providerOverrides: data?.providerOverrides,
      runtimeOverrides: {
        identifier: 'local.nodejs22.x',
        name: 'Local Node.js 22.x (Lambda-compatible)',
        configuration: {
          runtime: { identifier: 'nodejs', version: '22.x' },
          layer: {
            provider: 'aws.lambda',
            identifier: 'local-layer-nodejs22',
            version: '2026-01-01',
            os: 'linux',
            osIdentifier: 'aws-linux.any',
            arch: 'x86_64'
          }
        },
        ...data?.runtimeOverrides
      }
    });

  return {
    default: defaultRuntime,
    withProvider,
    withLocalProvider,
    nodejs22,
    localNodejs22
  };
};
