import { describe, expect, it } from 'vitest';
import {
  buildPostgresUrl,
  initializeMetorialServiceEnvironment,
  initializeRedisUrl,
  signGlobalDatabaseUrlWithIam
} from '.';

describe('service environment initialization', () => {
  it('builds the complete writer and reader database matrix', async () => {
    let env: Record<string, string> = {
      AWS_MODE: 'true',
      DATABASE_READER: 'true',
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

    await initializeMetorialServiceEnvironment(env);

    expect(env.DATABASE_URL).toContain(
      'core%20user:core%2Fpassword@core.cluster-example.local'
    );
    expect(env.DATABASE_URL_READER).toContain('core.cluster-ro-example.local');
    expect(env.SUBSPACE_DATABASE_URL).toContain('@subspace.cluster-example.local');
    expect(env.SUBSPACE_DATABASE_URL_READER).toContain('subspace.cluster-ro-example.local');
    expect(env.FEDERATION_CORE_DATABASE_URL).toContain('@federation.cluster-example.local');
    expect(env.PAYMENT_DATABASE_URL).toContain('@payment.cluster-example.local');
    expect(env.GLOBAL_DATABASE_URL).toContain('@global.cluster-example.local');
    expect(env.REDIS_URL).toBe('redis://localhost:6379/0');
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
});
