import { defineFactory } from '@lowerdeck/testing-tools';
import { randomBytes } from 'crypto';
import type { PrismaClient, Provider } from '../../../prisma/generated/client';
import { getId } from '../../id';
import { provider as awsLambdaProvider } from '../../providers/aws-lambda/provider';
import { provider as localProvider } from '../../providers/local/provider';

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
    return db.provider.upsert({
      where: { identifier: 'aws.lambda' },
      create: {
        oid: awsLambdaProvider.oid,
        id: awsLambdaProvider.id,
        identifier: 'aws.lambda',
        name: overrides.name ?? 'AWS Lambda'
      },
      update: {
        name: overrides.name ?? 'AWS Lambda'
      }
    });
  };

  const local = async (overrides: Partial<Provider> = {}): Promise<Provider> =>
    db.provider.upsert({
      where: { identifier: 'local' },
      create: {
        oid: localProvider.oid,
        id: localProvider.id,
        identifier: 'local',
        name: overrides.name ?? 'Local Runtime'
      },
      update: {
        name: overrides.name ?? 'Local Runtime'
      }
    });

  return {
    default: defaultProvider,
    withIdentifier,
    awsLambda,
    local
  };
};
