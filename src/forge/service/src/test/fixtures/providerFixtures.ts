import type { PrismaClient, Provider } from '../../../prisma/generated/client';
import { ID, snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { defaultProvider as cachedProvider } from '../../services/provider';

export const ProviderFixtures = (db: PrismaClient) => {
  const defaultProvider = async (overrides: Partial<Provider> = {}): Promise<Provider> => {
    const oid = overrides.oid ?? snowflake.nextId();
    const id = overrides.id ?? (await ID.generateId('provider'));
    const identifier = overrides.identifier ?? 'test-provider';

    const factory = defineFactory<Provider>(
      {
        oid,
        id,
        identifier,
        name: overrides.name ?? 'Test Provider',
        createdAt: overrides.createdAt ?? new Date()
      } as Provider,
      {
        persist: value =>
          db.provider.upsert({
            where: { identifier: value.identifier },
            create: value,
            update: {}
          })
      }
    );

    return factory.create(overrides);
  };

  // Return the cached production provider to avoid unique constraint violations
  const awsCodeBuild = async (_overrides: Partial<Provider> = {}): Promise<Provider> =>
    cachedProvider;

  return {
    default: defaultProvider,
    awsCodeBuild
  };
};
