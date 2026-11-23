import { describe, expect, it } from 'vitest';
import {
  buildMongoUrl,
  buildPostgresUrl,
  initializeDatabaseUrl,
  initializeMetorialServiceEnvironment,
  initializeRedisUrl,
  signGlobalDatabaseUrlWithIam
} from '.';

let databaseMatrix = {
  CORE_DB_USERNAME: 'core user',
  CORE_DB_PASSWORD: 'core/password',
  CORE_DB_HOST: 'core.cluster-example.local',
  CORE_DB_PORT: '5432',
  CORE_DB_NAME: 'core',
  SUBSPACE_DB_USERNAME: 'subspace',
  SUBSPACE_DB_PASSWORD: 'secret',
  SUBSPACE_DB_HOST: 'subspace.cluster-example.local',
  SUBSPACE_DB_PORT: '5432',
  SUBSPACE_DB_NAME: 'subspace',
  FEDERATION_DB_USERNAME: 'federation',
  FEDERATION_DB_PASSWORD: 'secret',
  FEDERATION_DB_HOST: 'federation.cluster-example.local',
  FEDERATION_DB_PORT: '5432',
  FEDERATION_DB_NAME: 'federation',
  PAYMENT_DB_USERNAME: 'payment',
  PAYMENT_DB_PASSWORD: 'secret',
  PAYMENT_DB_HOST: 'payment.cluster-example.local',
  PAYMENT_DB_PORT: '5432',
  PAYMENT_DB_NAME: 'payment',
  GLOBAL_DB_USERNAME: 'global',
  GLOBAL_DB_PASSWORD: 'secret',
  GLOBAL_DB_HOST: 'global.cluster-example.local',
  GLOBAL_DB_PORT: '5432',
  GLOBAL_DB_NAME: 'global',
  REDIS_URL: 'redis://localhost:6379'
};

let readerHosts = {
  CORE_DB_READER_HOST: 'core.cluster-ro-example.local',
  SUBSPACE_DB_READER_HOST: 'subspace.cluster-ro-example.local',
  FEDERATION_DB_READER_HOST: 'federation.cluster-ro-example.local',
  PAYMENT_DB_READER_HOST: 'payment.cluster-ro-example.local',
  GLOBAL_DB_READER_HOST: 'global.cluster-ro-example.local'
};

let legacyDatabase = {
  DATABASE_USERNAME: 'service',
  DATABASE_PASSWORD: 'p@ss',
  DATABASE_HOST: 'service.cluster-example.local',
  DATABASE_PORT: '5432',
  DATABASE_NAME: 'service'
};

describe('service environment initialization', () => {
  it('builds the complete writer and reader database matrix', async () => {
    let env: Record<string, string> = {
      AWS_MODE: 'true',
      DATABASE_READER: 'true',
      ...databaseMatrix,
      ...readerHosts
    };

    await initializeMetorialServiceEnvironment(env);

    expect(env.DATABASE_URL).toBe(
      'postgres://core%20user:core%2Fpassword@core.cluster-example.local:5432/core?schema=public&sslmode=no-verify&connection_limit=20'
    );
    expect(env.DATABASE_URL_READER).toBe(
      'postgres://core%20user:core%2Fpassword@core.cluster-ro-example.local:5432/core?schema=public&sslmode=no-verify&connection_limit=20'
    );
    expect(env.SUBSPACE_DATABASE_URL).toContain('@subspace.cluster-example.local');
    expect(env.SUBSPACE_DATABASE_URL_READER).toContain('@subspace.cluster-ro-example.local');
    expect(env.FEDERATION_CORE_DATABASE_URL).toContain('@federation.cluster-example.local');
    expect(env.FEDERATION_CORE_DATABASE_URL_READER).toContain(
      '@federation.cluster-ro-example.local'
    );
    expect(env.PAYMENT_DATABASE_URL).toContain('@payment.cluster-example.local');
    expect(env.PAYMENT_DATABASE_URL_READER).toContain('@payment.cluster-ro-example.local');
    expect(env.GLOBAL_DATABASE_URL).toContain('@global.cluster-example.local');
    expect(env.GLOBAL_DATABASE_URL_READER).toBeUndefined();
    expect(env.REDIS_URL).toBe('redis://localhost:6379/0');
  });

  it('builds no reader URLs while the reader kill switch is off', async () => {
    let env: Record<string, string> = {
      AWS_MODE: 'true',
      DATABASE_READER: 'false',
      ...databaseMatrix,
      ...readerHosts
    };

    await initializeMetorialServiceEnvironment(env);

    expect(env.DATABASE_URL).toContain('@core.cluster-example.local');
    expect(Object.keys(env).filter(key => key.endsWith('_URL_READER'))).toEqual([]);
  });

  it('never derives a reader host from the writer host', async () => {
    let env: Record<string, string> = {
      AWS_MODE: 'true',
      DATABASE_READER: 'true',
      ...databaseMatrix,
      PAYMENT_DB_READER_HOST: 'payment.cluster-ro-example.local'
    };

    await initializeMetorialServiceEnvironment(env);

    expect(env.DATABASE_URL).toContain('@core.cluster-example.local');
    expect(env.PAYMENT_DATABASE_URL_READER).toContain('@payment.cluster-ro-example.local');
    expect(Object.keys(env).filter(key => key.endsWith('_URL_READER'))).toEqual([
      'PAYMENT_DATABASE_URL_READER'
    ]);
  });

  it('builds legacy DATABASE_* URLs with an explicit reader host', async () => {
    let env: Record<string, string> = {
      DATABASE_READER: 'true',
      DATABASE_READER_HOST: 'service.cluster-ro-example.local',
      ...legacyDatabase
    };

    await initializeMetorialServiceEnvironment(env);

    expect(env.DATABASE_URL).toBe(
      'postgres://service:p%40ss@service.cluster-example.local:5432/service?schema=public&sslmode=no-verify&connection_limit=20'
    );
    expect(env.DATABASE_URL_READER).toBe(
      'postgres://service:p%40ss@service.cluster-ro-example.local:5432/service?schema=public&sslmode=no-verify&connection_limit=20'
    );
  });

  it('keeps a preset legacy DATABASE_URL', async () => {
    let env: Record<string, string> = {
      DATABASE_URL: 'postgres://preset',
      DATABASE_READER: 'true',
      DATABASE_READER_HOST: 'service.cluster-ro-example.local',
      ...legacyDatabase
    };

    await initializeMetorialServiceEnvironment(env);

    expect(env.DATABASE_URL).toBe('postgres://preset');
    expect(env.DATABASE_URL_READER).toBeUndefined();
  });

  it('builds authenticated and unauthenticated Redis URLs', () => {
    let authenticated: Record<string, string> = {
      REDIS_HOST: 'redis.local',
      REDIS_PORT: '6379',
      REDIS_TLS: 'true',
      REDIS_AUTH_TOKEN: 'a/b'
    };
    let unauthenticated: Record<string, string> = {
      REDIS_HOST: 'redis.local',
      REDIS_PORT: '6379'
    };

    initializeRedisUrl(authenticated);
    initializeRedisUrl(unauthenticated);

    expect(authenticated.REDIS_URL).toBe('rediss://:a%2Fb@redis.local:6379/0');
    expect(unauthenticated.REDIS_URL).toBe('redis://redis.local:6379/0');
  });

  it('signs a global database URL using an injected token provider', async () => {
    let env: Record<string, string> = {
      GLOBAL_DATABASE_URL: buildPostgresUrl({
        username: 'global-user',
        password: '',
        host: 'global.cluster-example.eu-west-1.rds.amazonaws.com',
        port: '5432',
        name: 'global'
      }),
      GLOBAL_DATABASE_ARN: 'arn:aws:rds:eu-west-1:123456789012:cluster:global'
    };

    await signGlobalDatabaseUrlWithIam(env, async input => {
      expect(input.region).toBe('eu-west-1');
      expect(input.username).toBe('global-user');
      return 'signed/token';
    });

    expect(env.GLOBAL_DATABASE_URL).toContain('global-user:signed%2Ftoken@');
  });

  it('builds the usage store URL as before', () => {
    expect(
      buildMongoUrl({
        username: 'usage user',
        password: 'p@ss/word',
        host: 'usage.cluster-example.docdb.amazonaws.com',
        port: '27017',
        database: 'usage',
        readPreference: 'secondaryPreferred'
      })
    ).toBe(
      'mongodb://usage%20user:p%40ss%2Fword@usage.cluster-example.docdb.amazonaws.com:27017/usage?authSource=admin&authMechanism=SCRAM-SHA-1&tls=true&tlsAllowInvalidCertificates=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false'
    );
  });
});

describe('initializeDatabaseUrl', () => {
  let hyperplaneDatabase = {
    HYPERPLANE_DB_USERNAME: 'hyperplane',
    HYPERPLANE_DB_PASSWORD: 'secret',
    HYPERPLANE_DB_HOST: 'hyperplane.cluster-example.local',
    HYPERPLANE_DB_PORT: '5432',
    HYPERPLANE_DB_NAME: 'mte-hyperplane'
  };

  it('builds a URL and its reader from prefixed parts', () => {
    let env: Record<string, string> = {
      DATABASE_READER: 'true',
      HYPERPLANE_DB_READER_HOST: 'hyperplane.cluster-ro-example.local',
      ...hyperplaneDatabase
    };

    initializeDatabaseUrl(env, { prefix: 'HYPERPLANE_DB', urlKey: 'HYPERPLANE_DATABASE_URL' });

    expect(env.HYPERPLANE_DATABASE_URL).toBe(
      'postgres://hyperplane:secret@hyperplane.cluster-example.local:5432/mte-hyperplane?schema=public&sslmode=no-verify&connection_limit=20'
    );
    expect(env.HYPERPLANE_DATABASE_URL_READER).toBe(
      'postgres://hyperplane:secret@hyperplane.cluster-ro-example.local:5432/mte-hyperplane?schema=public&sslmode=no-verify&connection_limit=20'
    );
  });

  it('skips the reader without an explicit reader host', () => {
    let env: Record<string, string> = { DATABASE_READER: 'true', ...hyperplaneDatabase };

    initializeDatabaseUrl(env, { prefix: 'HYPERPLANE_DB', urlKey: 'HYPERPLANE_DATABASE_URL' });

    expect(env.HYPERPLANE_DATABASE_URL).toContain('@hyperplane.cluster-example.local');
    expect(env.HYPERPLANE_DATABASE_URL_READER).toBeUndefined();
  });

  it('leaves the URL unset when no host is configured', () => {
    let env: Record<string, string> = {};

    initializeDatabaseUrl(env, { prefix: 'DATABASE', urlKey: 'DATABASE_URL' });

    expect(env.DATABASE_URL).toBeUndefined();
  });

  it('throws for missing parts when required', () => {
    let env: Record<string, string> = { ...legacyDatabase, DATABASE_PASSWORD: '' };

    expect(() =>
      initializeDatabaseUrl(env, {
        prefix: 'DATABASE',
        urlKey: 'DATABASE_URL',
        required: true
      })
    ).toThrow('DATABASE_URL is not set and DATABASE_* component env vars are missing');
  });
});
