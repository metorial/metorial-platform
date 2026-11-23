import { atomicWrite } from './files';
import type { LoadedManifest, ServicePorts } from './types';

export let postgresReplicaService = 'postgres-replica';

export let postgresReplicaVolume = 'postgres-replica-data';

let replicationRole = 'replicator';

let replicationSettings = ['wal_level=replica', 'max_wal_senders=10', 'wal_keep_size=512MB'];

export interface Requirements {
  postgres: boolean;
  mongo: boolean;
  redis: boolean;
  nats: boolean;
  etcd: boolean;
  mail: boolean;
}

export interface RenderOptions {
  project_name?: string;
  network: string;
  network_name?: string;
  mail_proxy_alias?: string;
  db_explorer_proxy_alias?: string;
  postgres_databases?: string[];
  postgres_replica?: { delay: string };
  ports?: ServicePorts;
  restart: boolean;
}

let escapeCompose = (value: string) => value.replaceAll('$', () => '$$');

export let postgresPrimaryArguments = (replica: boolean) =>
  replica ? replicationSettings.flatMap(setting => ['-c', setting]) : [];

// Runs inside the primary on every start because existing data volumes never rerun initdb scripts.
export let postgresPrimaryReplicationScript = `set -euo pipefail
line='host replication ${replicationRole} all scram-sha-256'
grep -qxF "$line" "$PGDATA/pg_hba.conf" || echo "$line" >> "$PGDATA/pg_hba.conf"
psql -v ON_ERROR_STOP=1 -U postgres -d postgres -XAtq >/dev/null <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${replicationRole}') THEN
    CREATE ROLE ${replicationRole} WITH REPLICATION LOGIN PASSWORD '${replicationRole}';
  END IF;
END
$$;
SELECT pg_reload_conf();
SQL
`;

// Re-seeds whenever the data directory is empty or belongs to a different primary cluster, e.g.
// after the primary volume was recreated.
let postgresReplicaScript = (delay: string) => `set -euo pipefail
primary='host=postgres-db2 port=5432 user=${replicationRole} password=${replicationRole} application_name=${postgresReplicaService}'
until primary_id=$(psql "$primary dbname=replication replication=true" -XAtc IDENTIFY_SYSTEM 2>/dev/null | cut -d '|' -f 1) && [ -n "$primary_id" ]; do
  echo 'waiting for postgres-db2 to accept replication connections'
  sleep 1
done
replica_id=
if [ -s "$PGDATA/PG_VERSION" ]; then
  replica_id=$(pg_controldata "$PGDATA" | sed -n 's/^Database system identifier: *//p')
fi
if [ "$replica_id" != "$primary_id" ]; then
  echo "seeding from postgres-db2 (system identifier $primary_id)"
  mkdir -p "$PGDATA"
  find "$PGDATA" -mindepth 1 -delete
  chown postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"
  gosu postgres pg_basebackup --dbname="$primary" --pgdata="$PGDATA" --write-recovery-conf --wal-method=stream --checkpoint=fast
fi
exec gosu postgres postgres -c hot_standby=on -c max_connections=1000 -c recovery_min_apply_delay=${delay}
`;

export let postgresReplicaDefinition = (delay: string): Record<string, unknown> => ({
  image: 'postgres:17',
  entrypoint: ['bash', '-c', escapeCompose(postgresReplicaScript(delay))],
  depends_on: { 'postgres-db2': { condition: 'service_healthy', restart: true } },
  healthcheck: {
    test: [
      'CMD-SHELL',
      `psql -U postgres -d postgres -XAtc "select pg_is_in_recovery() and exists (select from pg_stat_wal_receiver where status = 'streaming')" | grep -qx t`
    ],
    interval: '2s',
    timeout: '5s',
    retries: 5,
    start_period: '120s'
  }
});

export let requirementsFromManifests = (manifests: LoadedManifest[]): Requirements => {
  let result = {
    postgres: false,
    mongo: false,
    redis: false,
    nats: false,
    etcd: false,
    mail: false
  };

  for (let { manifest } of manifests) {
    result.postgres ||= !!Object.keys(manifest.postgres).length;
    result.mongo ||= !!Object.keys(manifest.mongo).length;

    for (let resource of manifest.resources) result[resource.type] = true;
  }

  return result;
};

export let postgresDatabases = (manifests: LoadedManifest[]) =>
  [
    ...new Set(
      manifests.flatMap(item => Object.values(item.manifest.postgres).map(db => db.database))
    )
  ].sort();

export let serviceNames = (requirements: Requirements) =>
  Object.entries({
    postgres: 'postgres-db2',
    db_explorer: 'drizzle-gateway',
    mongo: 'mongodb',
    redis: 'redis-db',
    nats: 'nats-1',
    etcd: 'etcd',
    mail: 'mailpit'
  })
    .filter(
      ([name]) =>
        requirements[name === 'db_explorer' ? 'postgres' : (name as keyof Requirements)]
    )
    .map(([, name]) => name);

export let volumeNames = (requirements: Requirements, replica = false) =>
  [
    ...Object.entries({ ...requirements, db_explorer: requirements.postgres })
      .filter(([, needed]) => needed)
      .map(([name]) => `${name}-data`),
    ...(replica && requirements.postgres ? [postgresReplicaVolume] : [])
  ].sort();

export let serviceDefinitions = (
  requirements: Requirements,
  options: RenderOptions
): Record<string, Record<string, unknown>> => {
  let services: Record<string, Record<string, unknown>> = {};
  let add = (
    name: string,
    type: keyof Requirements,
    definition: Record<string, unknown>,
    port: number,
    check: string[],
    timeout: string
  ) => {
    if (!requirements[type]) return;
    services[name] = {
      ...definition,
      ...(options.ports
        ? {
            ports:
              type === 'mail'
                ? [`${options.ports.mail}:${port}`, `${options.ports.mail_ui}:8025`]
                : [
                    `${options.ports[type === 'etcd' ? 'etcd_client' : type]}:${port}`,
                    ...(type === 'etcd' ? [`${options.ports.etcd_peer}:2380`] : [])
                  ]
          }
        : {}),
      volumes: [
        `${type}-data:${type === 'postgres' ? '/var/lib/postgresql/data' : type === 'mongo' ? '/data/db' : type === 'etcd' ? '/bitnami/etcd' : '/data'}`
      ],
      networks:
        type === 'mail' && options.mail_proxy_alias
          ? { [options.network]: {}, 'control-proxy': { aliases: [options.mail_proxy_alias] } }
          : [options.network],
      healthcheck: { test: check, interval: '2s', timeout, retries: 30 },
      ...(options.restart ? { restart: 'unless-stopped' } : {})
    };
  };
  add(
    'postgres-db2',
    'postgres',
    {
      image: 'postgres:17',
      command: [
        'postgres',
        '-c',
        'max_connections=1000',
        ...postgresPrimaryArguments(!!options.postgres_replica)
      ].join(' '),
      environment: { POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres' }
    },
    5432,
    ['CMD-SHELL', 'pg_isready -U postgres -d postgres'],
    '5s'
  );

  if (requirements.postgres && options.postgres_replica)
    services[postgresReplicaService] = {
      ...postgresReplicaDefinition(options.postgres_replica.delay),
      ...(options.ports?.postgres_replica
        ? { ports: [`${options.ports.postgres_replica}:5432`] }
        : {}),
      volumes: [`${postgresReplicaVolume}:/var/lib/postgresql/data`],
      networks: [options.network],
      ...(options.restart ? { restart: 'unless-stopped' } : {})
    };

  add(
    'mongodb',
    'mongo',
    {
      image: 'mongo:7',
      environment: { MONGO_INITDB_ROOT_USERNAME: 'mongo', MONGO_INITDB_ROOT_PASSWORD: 'mongo' }
    },
    27017,
    [
      'CMD-SHELL',
      "mongosh --quiet --username mongo --password mongo --authenticationDatabase admin --eval 'quit(db.runCommand({ ping: 1 }).ok ? 0 : 2)'"
    ],
    '5s'
  );

  add(
    'redis-db',
    'redis',
    { image: 'redis:7.4-alpine', command: 'redis-server --appendonly yes' },
    6379,
    ['CMD', 'redis-cli', 'ping'],
    '3s'
  );
  add(
    'nats-1',
    'nats',
    {
      image: 'nats:2.11-alpine',
      command: ['--jetstream', '--store_dir=/data', '--http_port=8222']
    },
    4222,
    ['CMD-SHELL', 'wget -q -O - http://127.0.0.1:8222/healthz >/dev/null'],
    '3s'
  );
  add(
    'etcd',
    'etcd',
    { image: 'bitnamilegacy/etcd:latest', environment: { ALLOW_NONE_AUTHENTICATION: 'yes' } },
    2379,
    ['CMD', 'etcdctl', 'endpoint', 'health'],
    '5s'
  );

  add(
    'mailpit',
    'mail',
    {
      image: 'axllent/mailpit:v1.27',
      environment: { MP_DATABASE: '/data/mailpit.db' }
    },
    1025,
    ['CMD', '/mailpit', 'readyz'],
    '3s'
  );

  if (requirements.postgres)
    services['drizzle-gateway'] = {
      image: 'ghcr.io/drizzle-team/gateway:1.7.0',
      environment: {
        PORT: '4983',
        STORE_PATH: '/app',
        ...Object.fromEntries(
          (options.postgres_databases?.length ? options.postgres_databases : ['postgres']).map(
            database => [
              `DATABASE_URL_${database}`,
              `postgresql://postgres:postgres@postgres-db2:5432/${encodeURIComponent(database)}`
            ]
          )
        )
      },
      volumes: ['db_explorer-data:/app'],
      ...(options.ports ? { ports: [`127.0.0.1:${options.ports.db_explorer}:4983`] } : {}),
      networks: options.db_explorer_proxy_alias
        ? {
            [options.network]: {},
            'control-proxy': { aliases: [options.db_explorer_proxy_alias] }
          }
        : [options.network],
      depends_on: { 'postgres-db2': { condition: 'service_healthy' } },
      ...(options.restart ? { restart: 'unless-stopped' } : {})
    };

  return services;
};

export let renderCompose = (requirements: Requirements, options: RenderOptions) => {
  let volumes = volumeNames(requirements, !!options.postgres_replica);

  return (
    JSON.stringify(
      {
        ...(options.project_name ? { name: options.project_name } : {}),
        services: serviceDefinitions(requirements, options),
        networks: {
          [options.network]: options.network_name ? { name: options.network_name } : {},
          ...((requirements.mail && options.mail_proxy_alias) ||
          (requirements.postgres && options.db_explorer_proxy_alias)
            ? { 'control-proxy': { name: 'control_proxy', external: true } }
            : {})
        },
        ...(volumes.length
          ? { volumes: Object.fromEntries(volumes.map(name => [name, {}])) }
          : {})
      },
      null,
      2
    ) + '\n'
  );
};

export let writeCompose = (
  path: string,
  requirements: Requirements,
  options: RenderOptions
) => {
  atomicWrite(path, renderCompose(requirements, options));

  return path;
};
