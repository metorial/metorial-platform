import { describe, expect, test } from 'vitest';
import { assertTestDatabaseUrl, createPrismaTestDb } from './prisma';

const createFakeClient = (tables: string[] = []) => {
  const queries: string[] = [];
  const calls: string[] = [];

  const client = {
    $connect: async () => {
      calls.push('connect');
    },
    $disconnect: async () => {
      calls.push('disconnect');
    },
    $queryRawUnsafe: async <T = unknown>() =>
      tables.map(tablename => ({ tablename })) as T,
    $executeRawUnsafe: async (query: string) => {
      queries.push(query);
      calls.push('execute');
      return 0;
    }
  };

  return { client, calls, queries };
};

describe('assertTestDatabaseUrl', () => {
  test('accepts url when guard matches', () => {
    expect(() => assertTestDatabaseUrl('postgres://localhost/test', 'test')).not.toThrow();
  });

  test('throws when guard rejects url', () => {
    expect(() => assertTestDatabaseUrl('postgres://localhost/prod', 'test')).toThrow(
      'Tests must use a test database'
    );
  });
});

describe('cleanDatabase', () => {
  test('truncates tables except excluded ones', async () => {
    const { client, queries } = createFakeClient(['users', 'sessions']);
    const db = createPrismaTestDb({
      url: 'postgres://localhost/test',
      guard: 'test',
      excludeTables: ['sessions'],
      prismaClientFactory: () => client
    });

    await db.clean();

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('TRUNCATE TABLE "users"');
    expect(queries[0]).not.toContain('sessions');
  });
});
