export type TestDbGuard = string | RegExp | ((url: string) => boolean);

type VitestHook = (fn: () => unknown | Promise<unknown>, timeout?: number) => void;

const getVitestHooks = () => {
  const globals = globalThis as typeof globalThis & {
    beforeAll?: VitestHook;
    beforeEach?: VitestHook;
    afterAll?: VitestHook;
  };
  const { beforeAll, beforeEach, afterAll } = globals;

  if (!beforeAll || !beforeEach || !afterAll) {
    throw new Error(
      'Vitest globals are not available. Use withTestDb inside test files, not setupFiles.'
    );
  }

  return { beforeAll, beforeEach, afterAll };
};

export type PrismaClientLike = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>;
  $executeRawUnsafe(query: string): Promise<number>;
};

export type CreatePrismaTestDbOptions<TClient extends PrismaClientLike> = {
  url?: string;
  guard?: TestDbGuard;
  label?: string;
  schema?: string;
  excludeTables?: string[];
  prismaClientFactory: (url: string) => TClient;
};

export const assertTestDatabaseUrl = (
  url: string,
  guard?: TestDbGuard,
  label: string = 'DATABASE_URL'
): void => {
  if (!url) {
    throw new Error(`${label} must be set for tests.`);
  }

  if (!guard) {
    return;
  }

  const isSafe =
    typeof guard === 'string'
      ? url.includes(guard)
      : guard instanceof RegExp
        ? guard.test(url)
        : guard(url);

  if (!isSafe) {
    throw new Error(`Tests must use a test database (${label}). Current ${label}: ${url}.`);
  }
};

export const cleanDatabase = async (
  prisma: PrismaClientLike,
  options: { schema?: string; excludeTables?: string[] } = {}
): Promise<void> => {
  const schema = options.schema ?? 'public';
  const exclude = new Set(options.excludeTables ?? []);

  const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = '${schema}'`
  );

  if (!tables.length) {
    return;
  }

  const tableNames = tables
    .map(table => table.tablename)
    .filter(name => !exclude.has(name))
    .map(name => `"${name}"`)
    .join(', ');

  if (!tableNames) {
    return;
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
};

export const createPrismaTestDb = <TClient extends PrismaClientLike>(
  options: CreatePrismaTestDbOptions<TClient>
) => {
  const label = options.label ?? 'DATABASE_URL';
  const url = options.url ?? process.env[label] ?? '';

  assertTestDatabaseUrl(url, options.guard, label);

  const client = options.prismaClientFactory(url);
  const clean = () =>
    cleanDatabase(client, {
      schema: options.schema,
      excludeTables: options.excludeTables
    });

  const connect = async () => {
    await client.$connect();
  };

  const disconnect = async () => {
    await client.$disconnect();
  };

  const setup = async () => {
    await connect();
    await clean();
  };

  const teardown = async () => {
    await disconnect();
  };

  return {
    client,
    connect,
    disconnect,
    clean,
    setup,
    teardown
  };
};

export const withTestDb = <TClient extends PrismaClientLike>(
  options: CreatePrismaTestDbOptions<TClient> & { cleanBeforeEach?: boolean }
) => {
  const db = createPrismaTestDb<TClient>(options);
  const { beforeAll, beforeEach, afterAll } = getVitestHooks();

  beforeAll(async () => {
    await db.connect();
    await db.clean();
  });

  if (options.cleanBeforeEach) {
    beforeEach(async () => {
      await db.clean();
    });
  }

  afterAll(async () => {
    await db.disconnect();
  });

  return {
    client: db.client,
    clean: db.clean
  };
};

export const setupPrismaTestDb = async <TClient extends PrismaClientLike>(
  options: CreatePrismaTestDbOptions<TClient>
) => {
  const db = createPrismaTestDb<TClient>(options);

  await db.connect();
  await db.clean();

  return db;
};
