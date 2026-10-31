import { atomicWrite } from './files';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { objectStorageDockerfile, objectStorageImage } from './images';
import type { LoadedManifest, ServicePorts } from './types';

export interface Requirements {
  postgres: boolean;
  mongo: boolean;
  redis: boolean;
  nats: boolean;
  etcd: boolean;
  object_storage?: boolean;
}

export interface RenderOptions {
  project_name?: string;
  network: string;
  network_name?: string;
  ports?: ServicePorts;
  restart: boolean;
  object_storage_build?: { context: string; dockerfile: string };
}

export let requirementsFromManifests = (manifests: LoadedManifest[]): Requirements => {
  let result: Requirements = {
    postgres: false,
    mongo: false,
    redis: false,
    nats: false,
    etcd: false
  };

  for (let { manifest } of manifests) {
    result.postgres ||= !!Object.keys(manifest.postgres).length;
    result.mongo ||= !!Object.keys(manifest.mongo).length;

    for (let resource of manifest.resources) result[resource.type] = true;
    if (JSON.stringify(manifest.env).includes('//services:52010'))
      result.object_storage = true;
  }

  return result;
};

export let serviceNames = (requirements: Requirements) =>
  Object.entries({
    postgres: 'postgres-db2',
    mongo: 'mongodb',
    redis: 'redis-db',
    nats: 'nats-1',
    etcd: 'etcd',
    object_storage: 'object-storage'
  })
    .filter(([name]) => requirements[name as keyof Requirements])
    .map(([, name]) => name);

export let volumeNames = (requirements: Requirements) =>
  Object.entries(requirements)
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
    type: Exclude<keyof Requirements, 'object_storage'>,
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
            ports: [
              `${options.ports[type === 'etcd' ? 'etcd_client' : type]}:${port}`,
              ...(type === 'etcd' ? [`${options.ports.etcd_peer}:2380`] : [])
            ]
          }
        : {}),
      volumes: [
        `${type}-data:${type === 'postgres' ? '/var/lib/postgresql/data' : type === 'mongo' ? '/data/db' : type === 'etcd' ? '/bitnami/etcd' : '/data'}`
      ],
      networks: [options.network],
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

  if (requirements.object_storage)
    services['object-storage'] = {
      image: objectStorageImage,
      ...(options.object_storage_build ? { build: options.object_storage_build } : {}),
      environment: {
        RUST_LOG: 'info',
        OBJECT_STORE__SERVER__HOST: '0.0.0.0',
        OBJECT_STORE__SERVER__PORT: '52010',
        OBJECT_STORE__BACKEND__TYPE: 'local',
        OBJECT_STORE__BACKEND__ROOT_PATH: '/app/data',
        OBJECT_STORE__BACKEND__PUBLIC_URL: 'http://localhost:35010'
      },
      ...(options.ports ? { ports: ['35010:52010'] } : {}),
      volumes: ['object_storage-data:/app/data'],
      networks: [options.network],
      healthcheck: {
        test: ['CMD-SHELL', 'curl -f http://localhost:52010/health || exit 1'],
        interval: '2s',
        timeout: '5s',
        retries: 30
      },
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
        [options.network]: options.network_name ? { name: options.network_name } : {}
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

export let objectStorageBuild = (root: string) => {
  let context = existsSync(join(root, 'oss', objectStorageDockerfile))
    ? join(root, 'oss')
    : root;
  return { context, dockerfile: objectStorageDockerfile };
};
