import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebAccessEvent } from '@metorial/review-engine';
import { securityReviewWebAccessService as service } from './securityReviewWebAccess';

let mocks = vi.hoisted(() => ({
  domainUpsert: vi.fn(),
  domainUpdate: vi.fn(),
  domains: vi.fn(),
  linkUpsert: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    securityReviewWebDomainUsage: {
      upsert: mocks.domainUpsert,
      updateMany: mocks.domainUpdate,
      findMany: mocks.domains
    },
    securityReviewWebDomainUsageReview: {
      upsert: mocks.linkUpsert
    },
    securityReviewRun: { findUniqueOrThrow: mocks.run }
  },
  withTransaction: mocks.transaction,
  getId: () => ({ oid: 1n, id: 'synthetic_id' })
}));

let now = new Date('2026-10-28T12:00:00Z');

let event = (overrides: Partial<WebAccessEvent> = {}): WebAccessEvent => ({
  domain: 'docs.vendor.com',
  operation: 'fetch',
  outcome: 'succeeded',
  dispatched: true,
  retriever: 'firecrawl',
  reason: null,
  attemptedAt: now,
  usedAt: now,
  reputation: { verdict: 'no_known_threats', threatTypes: [], checkedAt: now },
  ...overrides
});

let domain = (hostname: string) => ({
  oid: 1n,
  id: 'domain_1',
  domain: hostname,
  _count: { reviews: 4 },
  attempts: 50,
  dispatched: 30,
  succeeded: 20,
  blocked: 20,
  failed: 10,
  firstSeenAt: now,
  lastAttemptAt: now,
  lastUsedAt: now,
  lastOperation: 'fetch',
  lastOutcome: 'succeeded',
  lastReason: null,
  retriever: 'firecrawl',
  reputation: 'no_known_threats',
  threatTypes: [],
  reputationCheckedAt: now
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async fn => await fn());
  mocks.run.mockResolvedValue({ revision: { reviewOid: 100n } });
  mocks.domainUpsert.mockResolvedValue({ oid: 10n });
  mocks.linkUpsert.mockResolvedValue({ oid: 20n });
  mocks.domainUpdate.mockResolvedValue({ count: 1 });
});

describe('global security review web usage', () => {
  it('uses one global domain key across different reviews, runs and operations', async () => {
    await service.recordAccess({ runOid: 9n, event: event() });
    mocks.run.mockResolvedValue({ revision: { reviewOid: 200n } });
    await service.recordAccess({ runOid: 19n, event: event({ operation: 'search' }) });

    expect(mocks.domainUpsert.mock.calls.map(call => call[0].where)).toEqual([
      { domain: 'docs.vendor.com' },
      { domain: 'docs.vendor.com' }
    ]);
    expect(mocks.linkUpsert.mock.calls[0]![0]).toMatchObject({
      where: {
        domainUsageOid_reviewOid: {
          domainUsageOid: 10n,
          reviewOid: 100n
        }
      },
      create: { domainUsageOid: 10n, reviewOid: 100n }
    });
    expect(mocks.linkUpsert.mock.calls[1]![0].create).toMatchObject({
      domainUsageOid: 10n,
      reviewOid: 200n
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it('reuses the same link across runs and operations within a review', async () => {
    await service.recordAccess({ runOid: 9n, event: event() });
    await service.recordAccess({ runOid: 19n, event: event({ operation: 'search' }) });

    expect(mocks.linkUpsert.mock.calls.map(call => call[0].where)).toEqual([
      { domainUsageOid_reviewOid: { domainUsageOid: 10n, reviewOid: 100n } },
      { domainUsageOid_reviewOid: { domainUsageOid: 10n, reviewOid: 100n } }
    ]);
  });

  it('stores all usage on the global row and only identities on the link', async () => {
    await service.recordAccess({ runOid: 9n, event: event() });
    let update = {
      attempts: { increment: 1 },
      dispatched: { increment: 1 },
      succeeded: { increment: 1 },
      blocked: { increment: 0 },
      failed: { increment: 0 }
    };

    expect(mocks.domainUpsert.mock.calls[0]![0].update).toEqual(update);
    expect(mocks.linkUpsert.mock.calls[0]![0]).toEqual({
      where: { domainUsageOid_reviewOid: { domainUsageOid: 10n, reviewOid: 100n } },
      create: { oid: 1n, id: 'synthetic_id', domainUsageOid: 10n, reviewOid: 100n },
      update: {}
    });
    expect(mocks.domainUpsert.mock.calls[0]![0].create).not.toHaveProperty('runOid');
    expect(mocks.domainUpsert.mock.calls[0]![0].create).not.toHaveProperty('reviewOid');
    expect(mocks.domainUpsert.mock.calls[0]![0].create).not.toHaveProperty('url');
    expect(mocks.domainUpsert.mock.calls[0]![0].create).not.toHaveProperty('markdown');
  });

  it('propagates a link-write failure through the enclosing transaction', async () => {
    mocks.linkUpsert.mockRejectedValue(new Error('link failed'));

    await expect(service.recordAccess({ runOid: 9n, event: event() })).rejects.toThrow(
      'link failed'
    );
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.domainUpdate).not.toHaveBeenCalled();
  });

  it('records blocked attempts without a dispatch or last-used timestamp', async () => {
    await service.recordAccess({
      runOid: 9n,
      event: event({
        outcome: 'blocked',
        dispatched: false,
        usedAt: null,
        reputation: undefined,
        reason: 'sensitive_url'
      })
    });

    expect(mocks.domainUpsert.mock.calls[0]![0].create).toMatchObject({
      attempts: 1,
      dispatched: 0,
      succeeded: 0,
      blocked: 1,
      failed: 0,
      lastReason: 'sensitive_url'
    });
    expect(mocks.domainUpsert.mock.calls[0]![0].create).not.toHaveProperty('lastUsedAt');
  });

  it('guards global timestamps against out-of-order completion', async () => {
    await service.recordAccess({ runOid: 9n, event: event() });

    expect(mocks.domainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lastAttemptAt: { lte: now } })
      })
    );
    expect(mocks.domainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firstSeenAt: { gt: now } })
      })
    );
    expect(mocks.domainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: now } }]
        })
      })
    );
    expect(mocks.domainUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ reputationCheckedAt: null }, { reputationCheckedAt: { lt: now } }]
        })
      })
    );
  });

  it('lists persisted global totals directly rather than aggregating retained reviews', async () => {
    mocks.domains.mockResolvedValue([domain('a.vendor.com'), domain('b.vendor.com')]);
    let paginator = await service.listDomains({});
    let page = await paginator.run({ limit: 1, order: 'asc' });

    expect(page.items[0]).toMatchObject({
      id: 'a.vendor.com',
      attempts: 50,
      reviewCount: 4,
      dispatched: 30,
      succeeded: 20,
      blocked: 20,
      failed: 10
    });
    expect(page.pagination).toMatchObject({
      hasNextPage: true,
      hasPreviousPage: false,
      after: 'a.vendor.com'
    });
    expect(mocks.domains.mock.calls[0]![0].where.AND[0]).toHaveProperty('reviews', undefined);
  });

  it('keeps global totals visible when associated reviews are removed', async () => {
    mocks.domains.mockResolvedValue([{ ...domain('a.vendor.com'), _count: { reviews: 0 } }]);
    let page = await (await service.listDomains({})).run({ limit: 25 });

    expect(page.items[0]).toMatchObject({ attempts: 50, reviewCount: 0 });
  });

  it('filters by linked reviews and providers while always returning global usage', async () => {
    mocks.domains.mockResolvedValue([domain('a.vendor.com')]);
    let paginator = await service.listDomains({
      securityReviewId: 'review_1',
      providerId: 'provider_1',
      domain: 'Vendor',
      outcome: 'blocked',
      operation: 'fetch',
      since: now,
      until: now
    });
    let page = await paginator.run({ limit: 25, order: 'asc' });

    expect(page.items[0]).toMatchObject({
      attempts: 50,
      blocked: 20,
      reviewCount: 4,
      reputation: 'no_known_threats'
    });
    expect(mocks.domains.mock.calls[0]![0]).toMatchObject({
      where: {
        AND: [
          {
            domain: { contains: 'vendor' },
            blocked: { gt: 0 },
            lastOperation: 'fetch',
            lastAttemptAt: { gte: now, lte: now },
            reviews: {
              some: { review: { id: 'review_1', provider: { id: 'provider_1' } } }
            }
          },
          {}
        ]
      },
      include: { _count: { select: { reviews: true } } }
    });
  });

  it('paginates stable global hostnames in both directions', async () => {
    mocks.domains.mockResolvedValue([domain('b.vendor.com'), domain('a.vendor.com')]);
    let paginator = await service.listDomains({});
    let previous = await paginator.run({ limit: 2, order: 'asc', before: 'c.vendor.com' });

    expect(previous.items.map(item => item.id)).toEqual(['a.vendor.com', 'b.vendor.com']);
    expect(mocks.domains.mock.calls[0]![0]).toMatchObject({
      where: { AND: [expect.anything(), { domain: { lt: 'c.vendor.com' } }] },
      orderBy: { domain: 'desc' }
    });
    expect(previous.pagination).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
  });
});
