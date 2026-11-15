import { atomicWrite } from './files';
import type { LoadedManifest, ServicePorts } from './types';

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
  ports?: ServicePorts;
  restart: boolean;
}

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

export let volumeNames = (requirements: Requirements) =>
  Object.entries({ ...requirements, db_explorer: requirements.postgres })
    .filter(([, needed]) => needed)
    .map(([name]) => `${name}-data`)
    .sort();

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
      command: 'postgres -c max_connections=1000',
      environment: { POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'postgres' }
    },
    5432,
    ['CMD-SHELL', 'pg_isready -U postgres -d postgres'],
    '5s'
  );
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
        MASTERPASS: 'postgres',
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

export let renderCompose = (requirements: Requirements, options: RenderOptions) =>
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
      ...(volumeNames(requirements).length
        ? { volumes: Object.fromEntries(volumeNames(requirements).map(name => [name, {}])) }
        : {})
    },
    null,
    2
  ) + '\n';

export let writeCompose = (
  path: string,
  requirements: Requirements,
  options: RenderOptions
) => {
  atomicWrite(path, renderCompose(requirements, options));

  return path;
};
