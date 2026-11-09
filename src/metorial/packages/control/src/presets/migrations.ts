import type { RawBuildMigration } from '../types';

let awsPostgresQuery = 'schema=public&sslmode=no-verify&connection_limit=20';

export let migrations = {
  core: {
    name: 'core',
    package: '@metorial/db',
    env: 'DATABASE_URL',
    parts: 'CORE_DB',
    query: awsPostgresQuery,
    precedence: 'parts'
  },
  global: {
    name: 'global',
    package: '@metorial/multi-region',
    env: 'GLOBAL_DATABASE_URL',
    parts: 'GLOBAL_DB',
    fallback: 'DATABASE_URL',
    query: awsPostgresQuery,
    precedence: 'url',
    iam: { arnEnv: 'GLOBAL_DATABASE_ARN', regionEnv: 'GLOBAL_DB_REGION' }
  },
  subspace: {
    name: 'subspace',
    package: '@metorial-subspace/db',
    env: ['SUBSPACE_DATABASE_URL', 'DATABASE_URL'],
    parts: ['SUBSPACE_DB', 'DATABASE'],
    query: awsPostgresQuery,
    precedence: 'parts'
  },
  federation: {
    name: 'federation',
    package: '@metorial-enterprise/federation-data',
    env: 'FEDERATION_CORE_DATABASE_URL',
    parts: 'FEDERATION_DB'
  },
  payment: {
    name: 'payment',
    package: '@metorial-enterprise/federation-payment',
    env: 'PAYMENT_DATABASE_URL',
    parts: 'PAYMENT_DB'
  },
  hyperplane: {
    name: 'hyperplane',
    package: '@metorial/mte-hyperplane',
    env: 'HYPERPLANE_DATABASE_URL',
    parts: 'HYPERPLANE_DB'
  },
  genesis: {
    name: 'genesis',
    package: '@metorial-genesis/db',
    env: 'GENESIS_DATABASE_URL',
    parts: 'GENESIS_DB',
    precedence: 'url',
    defaults: { port: '5432', name: 'genesis' },
    encode: true,
    query: 'sslmode=require',
    lock: 7240316752601,
    renames: [
      { table: 'MachineImageVersion', from: 'manifestId', to: 'rootId' },
      { table: 'Disk', from: 'sealedManifestId', to: 'sealedRootId' }
    ]
  }
} satisfies Record<string, RawBuildMigration>;

export let ownMigration = (
  name: string,
  packageName: string,
  options: { prefix?: string; path?: string } = {}
): RawBuildMigration => ({
  name,
  package: packageName,
  ...(options.path ? { path: options.path } : {}),
  env: options.prefix ? [`${options.prefix}_DATABASE_URL`, 'DATABASE_URL'] : 'DATABASE_URL',
  parts: 'DATABASE',
  query: awsPostgresQuery,
  precedence: 'parts'
});
