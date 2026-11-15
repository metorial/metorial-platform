import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../env', () => ({
  env: {
    service: { REDIS_URL: 'redis://unused' },
    manifestSync: {
      ORIGIN_EXPORT_MAX_CONCURRENT_PER_ACCOUNT: 2,
      ORIGIN_GITHUB_WRITES_PER_MINUTE: 60,
      ORIGIN_GITHUB_WRITES_PER_HOUR: 450,
      ORIGIN_GITLAB_WRITES_PER_MINUTE: 120,
      ORIGIN_GITLAB_WRITES_PER_HOUR: 2000,
      ORIGIN_BITBUCKET_WRITES_PER_MINUTE: 30,
      ORIGIN_BITBUCKET_WRITES_PER_HOUR: 900
    }
  }
}));

import { createExportLimiter, getExportLimiterAccount } from './exportLimiter';

let repo = (provider: string, overrides: Record<string, any> = {}) =>
  ({
    provider,
    externalOwner: 'acme',
    installation: {
      externalInstallationId: '77',
      externalAccountId: '88',
      backend: { apiUrl: 'https://api.github.com', type: provider, ...overrides.backend }
    }
  }) as any;

describe('export limiter accounts', () => {
  it('keys GitHub by API host and installation', () => {
    expect(getExportLimiterAccount(repo('github'))).toEqual({
      key: 'github:api.github.com:77',
      writesPerMinute: 60,
      writesPerHour: 450
    });
  });

  it('keys GitLab by API host and connected account', () => {
    expect(
      getExportLimiterAccount(
        repo('gitlab', { backend: { apiUrl: 'https://gitlab.example/api/v4' } })
      )
    ).toMatchObject({ key: 'gitlab:gitlab.example:88', writesPerMinute: 120 });
  });

  it('keys Bitbucket Cloud by workspace and Data Center by account', () => {
    expect(
      getExportLimiterAccount(
        repo('bitbucket', {
          backend: { apiUrl: 'https://api.bitbucket.org/2.0', type: 'bitbucket' }
        })
      )
    ).toMatchObject({ key: 'bitbucket:api.bitbucket.org:acme' });
    expect(
      getExportLimiterAccount(
        repo('bitbucket', {
          backend: { apiUrl: 'https://bb.example', type: 'bitbucket_data_center' }
        })
      )
    ).toMatchObject({ key: 'bitbucket:bb.example:88' });
  });
});

// Origin's unit tests have no shared test Redis in CI; point this at a scratch database, e.g.
// ORIGIN_TEST_REDIS_URL=redis://localhost:<port from `control status`>/15.
let redisUrl = process.env.ORIGIN_TEST_REDIS_URL;

describe.skipIf(!redisUrl)(
  redisUrl
    ? 'export limiter against Redis'
    : 'export limiter against Redis (skipped: set ORIGIN_TEST_REDIS_URL to a scratch Redis database)',
  () => {
    let redis = redisUrl ? new Redis(redisUrl) : (undefined as unknown as Redis);
    let clock = Date.now();
    let prefix = `origin:test-export-limiter:${process.pid}:${Date.now()}`;
    let account = { key: 'github:api.github.com:1', writesPerMinute: 60, writesPerHour: 450 };
    let limiter = createExportLimiter({
      redis: () => redis,
      prefix,
      maxConcurrent: () => 2,
      now: () => clock
    });
    let acquire = (holder: string, want = 30) =>
      limiter.acquire({ account, holder, want, leaseMs: 60_000 });
    let release = (holder: string, granted: number, used = granted) =>
      limiter.release({ account, holder, granted, used });

    beforeEach(async () => {
      clock = Date.now();
      let keys = await redis.keys(`${prefix}:*`);
      if (keys.length) await redis.del(...keys);
    });

    afterAll(async () => {
      let keys = await redis.keys(`${prefix}:*`);
      if (keys.length) await redis.del(...keys);
      redis.disconnect();
    });

    it('grants up to the requested write budget from a full bucket', async () => {
      await expect(acquire('a')).resolves.toEqual({ granted: true, tokens: 30 });
    });

    it('caps concurrent exports per account at two and frees the slot on release', async () => {
      await acquire('a', 5);
      await acquire('b', 5);
      await expect(acquire('c', 5)).resolves.toMatchObject({
        granted: false,
        reason: 'concurrency'
      });

      await release('a', 5);
      await expect(acquire('c', 5)).resolves.toMatchObject({ granted: true });
    });

    it('lets a holder re-acquire its own slot', async () => {
      await acquire('a', 5);
      await acquire('b', 5);
      await expect(acquire('a', 5)).resolves.toMatchObject({ granted: true });
    });

    it('expires abandoned leases', async () => {
      await acquire('a', 5);
      await acquire('b', 5);
      clock += 61_000;
      await expect(acquire('c', 5)).resolves.toMatchObject({ granted: true });
    });

    it('grants what is left and then asks the caller to wait for a refill', async () => {
      await acquire('a', 30);
      await release('a', 30);
      await acquire('a', 28);
      await release('a', 28);

      await expect(acquire('a', 30)).resolves.toEqual({
        granted: false,
        reason: 'tokens',
        retryAt: new Date(clock + 3_000)
      });

      clock += 10_000;
      await expect(acquire('a', 30)).resolves.toEqual({ granted: true, tokens: 12 });
    });

    it('returns unused tokens to the bucket', async () => {
      await acquire('a', 30);
      await release('a', 30, 5);

      await expect(acquire('a', 60)).resolves.toEqual({ granted: true, tokens: 55 });
    });

    it('charges nothing for a slice that wrote nothing', async () => {
      await acquire('a', 30);
      await release('a', 30, 0);

      await expect(acquire('a', 60)).resolves.toEqual({ granted: true, tokens: 60 });
    });

    it('charges writes made beyond the grant', async () => {
      await acquire('a', 10);
      await release('a', 10, 40);

      await expect(acquire('a', 60)).resolves.toEqual({ granted: true, tokens: 20 });
    });

    it('makes an overdrawn bucket wait for its refill', async () => {
      await acquire('a', 60);
      await release('a', 60, 75);

      await expect(acquire('a', 30)).resolves.toEqual({
        granted: false,
        reason: 'tokens',
        retryAt: new Date(clock + 20_000)
      });
    });

    it('never refills past capacity', async () => {
      await acquire('a', 10);
      await release('a', 1_000, 0);

      await expect(acquire('a', 1_000)).resolves.toEqual({ granted: true, tokens: 60 });
    });

    it('enforces the hourly budget across minutes', async () => {
      for (let minute = 0; minute < 8; minute++) {
        await acquire('a', 60);
        await release('a', 60);
        clock += 60_000;
      }

      await expect(acquire('a', 60)).resolves.toEqual({ granted: true, tokens: 30 });
    });

    it('keeps accounts independent', async () => {
      await acquire('a', 60);
      let other = { ...account, key: 'github:api.github.com:2' };
      await expect(
        limiter.acquire({ account: other, holder: 'x', want: 30, leaseMs: 60_000 })
      ).resolves.toEqual({ granted: true, tokens: 30 });
    });

    it('stores all keys of an account in one cluster slot', async () => {
      await acquire('a');
      let keys = await redis.keys(`${prefix}:*`);
      expect(keys.sort()).toEqual(
        ['active', 'hour', 'minute'].map(suffix => `${prefix}:{${account.key}}:${suffix}`)
      );
    });
  }
);
