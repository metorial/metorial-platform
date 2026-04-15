import { randomBytes } from 'crypto';
import type { PrismaClient, Provider } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';

export const ProviderFixtures = (db: PrismaClient) => {
  const defaultProvider = async (overrides: Partial<Provider> = {}): Promise<Provider> => {
    const { oid, id } = getId('provider');
    const identifier =
      overrides.identifier ?? `test-provider-${randomBytes(4).toString('hex')}`;

    const factory = defineFactory<Provider>(
      {
        oid,
        id,
        identifier,
        name: overrides.name ?? `Test Provider ${identifier}`
      } as Provider,
      {
        persist: value => db.provider.create({ data: value })
      }
    );

    return factory.create(overrides);
  };

  const withIdentifier = async (
    identifier: string,
    overrides: Partial<Provider> = {}
  ): Promise<Provider> =>
    defaultProvider({
      identifier,
      name: overrides.name ?? `Provider ${identifier}`,
      ...overrides
    });

  const awsLambda = async (overrides: Partial<Provider> = {}): Promise<Provider> => {
    // Use upsert since aws.lambda may already exist from module-level seeding
    const { oid, id } = getId('provider');
    return db.provider.upsert({
      where: { identifier: 'aws.lambda' },
      create: {
        oid,
        id,
        identifier: 'aws.lambda',
        name: overrides.name ?? 'AWS Lambda'
      },
      update: {
        name: overrides.name ?? 'AWS Lambda'
      }
    });
  };

  return {
    default: defaultProvider,
    withIdentifier,
    awsLambda
  };
};
