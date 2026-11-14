import { afterEach, describe, expect, it, vi } from 'vitest';

let load = async (env: Record<string, string>) => {
  vi.resetModules();
  vi.stubEnv('REDIS_URL', 'redis://localhost');
  vi.stubEnv('OBJECT_STORAGE_URL', 'http://localhost');
  vi.stubEnv('SECURITY_REVIEW_BUCKET_NAME', 'bucket');
  vi.stubEnv('ORIGIN_URL', 'http://localhost');
  vi.stubEnv('CLOUDFLARE_AI_API_TOKEN', '');
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
  vi.stubEnv('AI_GATEWAY_API_KEY', '');
  for (let [key, value] of Object.entries(env)) vi.stubEnv(key, value);

  return await import('./thoroughness');
};

afterEach(() => vi.unstubAllEnvs());

describe('thoroughness tiers', () => {
  it('has no AI review without a model provider', async () => {
    let { isAiReviewAvailable, getThoroughnessTier } = await load({});

    expect(isAiReviewAvailable()).toBe(false);
    expect(() => getThoroughnessTier({ thoroughness: 'standard', scope: 'global' })).toThrow();
  });

  it('needs both the Cloudflare token and the account id', async () => {
    let { isAiReviewAvailable } = await load({ CLOUDFLARE_AI_API_TOKEN: 'token' });

    expect(isAiReviewAvailable()).toBe(false);
  });

  it('gives slates at least $3 and 1000 steps of analysis budget', async () => {
    let { getThoroughnessTier } = await load({ AI_GATEWAY_API_KEY: 'key' });

    expect(
      getThoroughnessTier({ thoroughness: 'standard', scope: 'global' }).maxCostMicros
    ).toBe(3_000_000);
    expect(getThoroughnessTier({ thoroughness: 'deep', scope: 'global' }).maxCostMicros).toBe(
      3_000_000
    );
    expect(getThoroughnessTier({ thoroughness: 'standard', scope: 'global' }).maxSteps).toBe(
      1000
    );
  });

  it('keeps tenant budgets unchanged', async () => {
    let { getThoroughnessTier } = await load({ AI_GATEWAY_API_KEY: 'key' });

    expect(
      getThoroughnessTier({ thoroughness: 'standard', scope: 'tenant' }).maxCostMicros
    ).toBe(750_000);
    expect(getThoroughnessTier({ thoroughness: 'standard', scope: 'tenant' }).maxSteps).toBe(
      350
    );
  });
});
