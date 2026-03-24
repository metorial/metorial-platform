import type {
  PrismaClient,
  ConnectionLogsStorageBucket
} from '../../../prisma/generated/client';
import { snowflake } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';

export const ConnectionLogsBucketFixtures = (db: PrismaClient) => {
  const defaultBucket = async (
    overrides: Partial<ConnectionLogsStorageBucket> = {}
  ): Promise<ConnectionLogsStorageBucket> => {
    const oid = overrides.oid ?? snowflake.nextId();

    const factory = defineFactory<ConnectionLogsStorageBucket>(
      {
        oid,
        bucket: overrides.bucket ?? `logs-${oid}`,
        createdAt: new Date(),
        ...overrides
      } as ConnectionLogsStorageBucket,
      {
        persist: value => db.connectionLogsStorageBucket.create({ data: value })
      }
    );

    return factory.create(overrides);
  };

  return {
    default: defaultBucket
  };
};
