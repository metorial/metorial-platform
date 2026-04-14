import { randomBytes } from 'crypto';
import type { PrismaClient, Runtime, Provider } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
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
          runtime: { provider: 'aws.lambda', runtime: 'nodejs22.x' },
          layer: { type: 'aws.arn', arn: 'arn:aws:lambda:us-east-1:123456789:layer:test:1' }
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
          runtime: { provider: 'aws.lambda', runtime: 'nodejs22.x' },
          layer: { type: 'aws.arn', arn: 'arn:aws:lambda:us-east-1:123456789:layer:nodejs:1' }
        },
        ...data?.runtimeOverrides
      }
    });

  return {
    default: defaultRuntime,
    withProvider,
    nodejs22
  };
};
