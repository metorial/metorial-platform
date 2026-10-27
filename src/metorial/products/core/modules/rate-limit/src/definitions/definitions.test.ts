import { afterEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    instance: { findUniqueOrThrow: vi.fn(async () => ({ projectOid: 5n })) },
    project: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: 'prj_5',
        oid: 5n,
        organization: { id: 'org_5', oid: 4n }
      }))
    }
  }
}));

vi.mock('@metorial/db', () => ({ db }));
vi.mock('@metorial/cache', () => ({
  createLocallyCachedFunction: (opts: { provider: (i: any) => any }) => opts.provider
}));

import { rateLimitService } from '../services';
import { getRateLimitUsageType, rateLimitUsageTypes } from './catalog';
import { formatRateLimitInterval, parseRateLimitInterval } from './interval';
import { allowAllRateLimitProvider, setRateLimitProvider } from './provider';

let scope = {
  organization: { id: 'org_1', oid: 1n },
  project: { id: 'prj_1', oid: 1n }
};

describe('parseRateLimitInterval', () => {
  it('parses shorthand intervals', () => {
    expect(parseRateLimitInterval('1s')).toBe(1);
    expect(parseRateLimitInterval('10m')).toBe(600);
    expect(parseRateLimitInterval('1h')).toBe(3600);
    expect(parseRateLimitInterval('1d')).toBe(86400);
    expect(parseRateLimitInterval(30)).toBe(30);
  });

  it('rejects intervals outside of 1s to 1d', () => {
    expect(() => parseRateLimitInterval('0s')).toThrow();
    expect(() => parseRateLimitInterval('2d')).toThrow();
    expect(() => parseRateLimitInterval(1.5)).toThrow();
    expect(() => parseRateLimitInterval('1w' as any)).toThrow();
  });

  it('formats seconds back into the largest whole unit', () => {
    expect(formatRateLimitInterval(86400)).toBe('1d');
    expect(formatRateLimitInterval(600)).toBe('10m');
    expect(formatRateLimitInterval(90)).toBe('90s');
  });
});

describe('rateLimitCatalog', () => {
  it('flattens usage types with unique keys', () => {
    let keys = rateLimitUsageTypes.map(usage => usage.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(getRateLimitUsageType('sessions.created')?.kind).toBe('rate');
    expect(getRateLimitUsageType('sandbox.machines')?.enforcement).toBe('synced');
    expect(
      rateLimitUsageTypes
        .filter(usage => usage.group === 'sandbox')
        .every(usage => usage.enforcement === 'synced')
    ).toBe(true);
  });
});

describe('rateLimitService', () => {
  afterEach(() => setRateLimitProvider(allowAllRateLimitProvider));

  it('allows everything by default', async () => {
    let result = await rateLimitService.tryConsume({
      ...scope,
      usages: [{ key: 'sessions.created' }]
    });

    expect(result).toEqual({ allowed: true });
  });

  it('never resolves an instance scope while everything is allowed', async () => {
    await rateLimitService.consume({
      instance: { oid: 9n },
      usages: [{ key: 'sessions.created' }]
    });

    expect(db.instance.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('resolves the organization and project for an instance', async () => {
    let consume = vi.fn(async () => ({ allowed: true }) as const);
    setRateLimitProvider({ ...allowAllRateLimitProvider, consume });

    await rateLimitService.consume({
      instance: { oid: 9n },
      usages: [{ key: 'sessions.created' }]
    });

    expect(consume).toHaveBeenCalledWith({
      organization: { id: 'org_5', oid: 4n },
      project: { id: 'prj_5', oid: 5n },
      usages: [{ key: 'sessions.created' }]
    });
  });

  it('throws a 429 when the provider rejects', async () => {
    setRateLimitProvider({
      ...allowAllRateLimitProvider,
      consume: async () => ({
        allowed: false,
        key: 'sessions.created',
        window: 'burst',
        retryAfterMs: 1500,
        limit: { amount: 10, intervalSeconds: 1 }
      })
    });

    await expect(
      rateLimitService.consume({ ...scope, usages: [{ key: 'sessions.created' }] })
    ).rejects.toMatchObject({
      data: { status: 429, code: 'rate_limit_exceeded', window: 'burst', retryAfterMs: 1500 }
    });
  });
});
