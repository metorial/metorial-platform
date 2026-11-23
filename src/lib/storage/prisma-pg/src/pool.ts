import type { ClientBase, PoolConfig } from 'pg';
import type { PrismaPgAdapterOptions } from './reporting';

let DEFAULT_MAX_CONNECTIONS = 10;
let CONNECTION_TIMEOUT_MS = 30_000;
let KEEP_ALIVE_INITIAL_DELAY_MS = 10_000;
let MAX_CONNECTION_LIFETIME_SECONDS = 600;

export type PoolConfigWithSetup = Omit<PoolConfig, 'onConnect'> & {
  onConnect?: (client: ClientBase) => void | Promise<void>;
};

export class ReadOnlyPrimaryError extends Error {
  constructor(databaseName: string) {
    super(
      `Refusing ${databaseName} primary connection: the server is read-only (pg_is_in_recovery). ` +
        'This usually means DNS still points at a demoted writer after a failover.'
    );
    this.name = 'ReadOnlyPrimaryError';
  }
}

let rejectReadOnlyServer = (databaseName: string) => async (client: ClientBase) => {
  let result = await client.query<{ recovery: boolean }>(
    'SELECT pg_is_in_recovery() AS recovery'
  );
  if (result.rows[0]?.recovery) throw new ReadOnlyPrimaryError(databaseName);
};

export let withPoolDefaults = (
  config: PoolConfig,
  options: PrismaPgAdapterOptions
): PoolConfigWithSetup => {
  let { onConnect, ...rest } = config as PoolConfigWithSetup;
  let guard =
    options.role === 'primary' ? rejectReadOnlyServer(options.databaseName) : undefined;

  return {
    max: DEFAULT_MAX_CONNECTIONS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    keepAlive: true,
    keepAliveInitialDelayMillis: KEEP_ALIVE_INITIAL_DELAY_MS,
    maxLifetimeSeconds: MAX_CONNECTION_LIFETIME_SECONDS,
    application_name: `${options.databaseName}:${options.role}`,
    ...rest,
    onConnect:
      guard && onConnect
        ? async client => {
            await guard(client);
            await onConnect(client);
          }
        : (guard ?? onConnect)
  };
};
