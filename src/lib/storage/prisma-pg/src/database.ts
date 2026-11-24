import type { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { createPrismaPgAdapter } from './adapter';
import { createReadRouter, createReplicaCircuit } from './readRouting';
import {
  createTransactionManager,
  type TransactionCapableClient,
  type TransactionManagerOptions
} from './transactions';

type Env = Record<string, string | undefined>;

type DatabasePoolConfig = Omit<PoolConfig, 'connectionString'>;

type ExtensibleClient = TransactionCapableClient & {
  $extends: (extension: any) => any;
};

export type DatabaseOptions<Client extends ExtensibleClient> = {
  name: string;
  url: string | string[];
  env?: Env;
  environment?: string;
  createClient: (adapter: PrismaPg) => Client;
  extend?: (client: Client) => Client;
  pool?: DatabasePoolConfig & { replica?: DatabasePoolConfig };
  afterHookDelayMs?: TransactionManagerOptions['afterHookDelayMs'];
  warnOnAfterHookOutsideTransaction?: TransactionManagerOptions['warnOnAfterHookOutsideTransaction'];
};

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

let describeConnection = (url: string) => {
  try {
    let parsed = new URL(url);
    return {
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      user: decodeURIComponent(parsed.username)
    };
  } catch {
    return undefined;
  }
};

export let resolveDatabaseUrls = (opts: {
  name: string;
  url: string | string[];
  env?: Env;
}) => {
  let env = opts.env ?? process.env;
  let keys = Array.isArray(opts.url) ? opts.url : [opts.url];
  let urlKey = keys.find(key => env[key]) ?? keys[0]!;
  let readerKey = `${urlKey}_READER`;

  let primaryUrl = env[urlKey];
  let replicaUrl = env[readerKey];

  if (replicaUrl) {
    if (!primaryUrl) {
      throw new DatabaseConfigError(
        `[${opts.name}] ${readerKey} is set but ${urlKey} is not; a reader needs its primary.`
      );
    }

    let primary = describeConnection(primaryUrl);
    let replica = describeConnection(replicaUrl);

    if (!primary || !replica) {
      throw new DatabaseConfigError(
        `[${opts.name}] ${urlKey} or ${readerKey} is not a valid URL.`
      );
    }

    if (primary.database !== replica.database || primary.user !== replica.user) {
      throw new DatabaseConfigError(
        `[${opts.name}] ${readerKey} connects to database "${replica.database}" as "${replica.user}", ` +
          `but ${urlKey} connects to "${primary.database}" as "${primary.user}". ` +
          'A reader must point at the same database as its primary.'
      );
    }
  }

  return { urlKey, readerKey, primaryUrl, replicaUrl };
};

/**
 * Creates a database client whose reads go to the primary unless the caller opts in with
 * `withReplicaReads`. The returned `db` follows the active `withTransaction` transaction.
 */
export let createDatabase = <Client extends ExtensibleClient>(
  opts: DatabaseOptions<Client>
) => {
  let environment = opts.environment ?? process.env.METORIAL_ENV;
  let { primaryUrl, replicaUrl } = resolveDatabaseUrls(opts);
  let { replica: replicaPool, ...primaryPool } = opts.pool ?? {};

  let primary = opts.createClient(
    createPrismaPgAdapter(
      { ...primaryPool, connectionString: primaryUrl },
      { environment, databaseName: opts.name, role: 'primary' }
    )
  );
  let client = opts.extend ? opts.extend(primary) : primary;

  if (replicaUrl) {
    let replica = opts.createClient(
      createPrismaPgAdapter(
        { ...primaryPool, ...replicaPool, connectionString: replicaUrl },
        { environment, databaseName: opts.name, role: 'replica' }
      )
    );

    client = client.$extends(
      createReadRouter({
        name: opts.name,
        replica,
        circuit: createReplicaCircuit(),
        onReplicaError: error =>
          console.warn(`[${opts.name}] replica read failed, using the primary for 10s`, error)
      })
    );
  }

  return {
    ...createTransactionManager(client, {
      name: opts.name,
      afterHookDelayMs: opts.afterHookDelayMs,
      warnOnAfterHookOutsideTransaction: opts.warnOnAfterHookOutsideTransaction
    }),
    hasReplica: !!replicaUrl
  };
};
