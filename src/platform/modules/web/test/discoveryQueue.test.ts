import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  discoveryFindUnique: vi.fn(),
  discoveryUpdateMany: vi.fn(),
  pageFindUnique: vi.fn(),
  pageUpsert: vi.fn(),
  inspectPage: vi.fn(),
  generateId: vi.fn(async () => 'wpg_new')
}));

vi.mock('@metorial/db', () => ({
  db: {
    webDiscovery: {
      findUnique: mocks.discoveryFindUnique,
      updateMany: mocks.discoveryUpdateMany
    },
    webPage: { findUnique: mocks.pageFindUnique, upsert: mocks.pageUpsert }
  },
  ID: { generateId: mocks.generateId },
  Prisma: { DbNull: 'DbNull' }
}));

vi.mock('@metorial/queue', () => {
  class QueueRetryError extends Error {}

  return {
    QueueRetryError,
    createQueue: () => ({ add: vi.fn(), process: (cb: unknown) => cb })
  };
});

vi.mock('../src/lib/inspectPage', () => ({ inspectPage: mocks.inspectPage }));

import { QueueRetryError } from '@metorial/queue';
import { DISCOVERY_MAX_ATTEMPTS } from '../src/lib/limits';
import { runDiscoveryProcessor } from '../src/queues/discovery';

let run = runDiscoveryProcessor as unknown as (data: { discoveryId: string }) => Promise<void>;

let discovery = (overrides: Record<string, unknown> = {}) => ({
  oid: 1n,
  id: 'wdsc_1',
  attempts: 0,
  url: 'https://docs.mcp.cloudflare.com/mcp',
  ...overrides
});

let candidate = (
  overrides: Partial<PrismaJson.WebImageCandidate> = {}
): PrismaJson.WebImageCandidate => ({
  url: 'https://cloudflare.com/icon.png',
  source: 'apple_touch_icon',
  declaredWidth: null,
  declaredHeight: null,
  width: 180,
  height: 180,
  format: 'png',
  bytes: 1000,
  score: 92,
  rejectedReason: null,
  ...overrides
});

let inspected = (overrides: Record<string, unknown> = {}) => ({
  finalUrl: 'https://x/',
  httpStatus: 200,
  contentType: 'text/html',
  bytesRead: 100,
  errorCode: null,
  title: 'Title',
  description: null,
  siteName: null,
  lang: null,
  themeColor: null,
  canonicalUrl: null,
  candidates: [],
  ...overrides
});

let lastUpdate = () => mocks.discoveryUpdateMany.mock.calls.at(-1)![0];

describe('run discovery queue', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());

    mocks.generateId.mockResolvedValue('wpg_new');
    mocks.discoveryFindUnique.mockResolvedValue(discovery());
    mocks.discoveryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.pageFindUnique.mockResolvedValue(null);
    mocks.pageUpsert.mockImplementation(async (args: any) => ({
      oid: BigInt(mocks.pageUpsert.mock.calls.length),
      ...args.update
    }));
  });

  it('does nothing when the row is missing or already claimed', async () => {
    mocks.discoveryFindUnique.mockResolvedValue(null);
    await run({ discoveryId: 'wdsc_1' });

    mocks.discoveryFindUnique.mockResolvedValue(discovery());
    mocks.discoveryUpdateMany.mockResolvedValue({ count: 0 });
    await run({ discoveryId: 'wdsc_1' });

    expect(mocks.inspectPage).not.toHaveBeenCalled();
  });

  it('stops walking up once a good icon is found', async () => {
    mocks.inspectPage.mockResolvedValue(inspected({ candidates: [candidate()] }));

    await run({ discoveryId: 'wdsc_1' });

    expect(mocks.inspectPage).toHaveBeenCalledTimes(1);
    expect(lastUpdate().data).toMatchObject({
      status: 'succeeded',
      title: 'Title',
      image: { type: 'url', url: 'https://cloudflare.com/icon.png' },
      imageSource: 'apple_touch_icon'
    });
  });

  it('falls back to a better icon on a parent page', async () => {
    mocks.inspectPage
      .mockResolvedValueOnce(inspected({ errorCode: 'http_client_error', title: null }))
      .mockResolvedValueOnce(
        inspected({
          candidates: [
            candidate({
              url: 'https://sub/favicon.ico',
              source: 'icon',
              score: 50,
              format: 'ico'
            })
          ]
        })
      )
      .mockResolvedValueOnce(inspected({ candidates: [] }))
      .mockResolvedValueOnce(
        inspected({
          title: 'Root',
          candidates: [candidate({ url: 'https://root/apple.png' })]
        })
      );

    await run({ discoveryId: 'wdsc_1' });

    expect(mocks.inspectPage).toHaveBeenCalledTimes(4);
    expect(lastUpdate().data).toMatchObject({
      status: 'succeeded',
      image: { type: 'url', url: 'https://root/apple.png' },
      title: 'Title'
    });
  });

  it('succeeds without an image when no candidate verifies', async () => {
    mocks.inspectPage.mockResolvedValue(inspected({ candidates: [] }));

    await run({ discoveryId: 'wdsc_1' });

    expect(lastUpdate().data).toMatchObject({
      status: 'succeeded',
      image: 'DbNull',
      bestPageOid: null
    });
  });

  it('reuses fresh cached pages and refetches failed ones', async () => {
    let fresh = {
      oid: 7n,
      errorCode: null,
      fetchedAt: new Date(),
      title: 'Cached',
      candidates: [candidate()]
    };
    mocks.pageFindUnique.mockResolvedValueOnce(fresh);

    await run({ discoveryId: 'wdsc_1' });

    expect(mocks.inspectPage).not.toHaveBeenCalled();
    expect(lastUpdate().data).toMatchObject({ status: 'succeeded', bestPageOid: 7n });

    mocks.pageFindUnique.mockResolvedValue({ ...fresh, errorCode: 'http_client_error' });
    mocks.inspectPage.mockResolvedValue(inspected({ candidates: [candidate()] }));

    await run({ discoveryId: 'wdsc_1' });

    expect(mocks.inspectPage).toHaveBeenCalledTimes(1);
  });

  it('retries when every page failed transiently', async () => {
    mocks.inspectPage.mockResolvedValue(inspected({ errorCode: 'timeout' }));

    await expect(run({ discoveryId: 'wdsc_1' })).rejects.toBeInstanceOf(QueueRetryError);

    expect(lastUpdate().data).toMatchObject({ status: 'pending', leaseExpiresAt: null });
  });

  it('fails once the retry budget is exhausted', async () => {
    mocks.discoveryFindUnique.mockResolvedValue(
      discovery({ attempts: DISCOVERY_MAX_ATTEMPTS - 1 })
    );
    mocks.inspectPage.mockResolvedValue(inspected({ errorCode: 'timeout' }));

    await run({ discoveryId: 'wdsc_1' });

    expect(lastUpdate().data).toMatchObject({
      status: 'failed',
      errorCode: 'no_page_reachable'
    });
  });

  it('fails immediately on permanent errors', async () => {
    mocks.inspectPage.mockResolvedValue(inspected({ errorCode: 'blocked_address' }));

    await run({ discoveryId: 'wdsc_1' });

    expect(lastUpdate().data).toMatchObject({
      status: 'failed',
      errorMessage: 'blocked_address'
    });
  });

  it('releases the lease when something unexpected throws', async () => {
    mocks.inspectPage.mockRejectedValue(new Error('database exploded'));

    await expect(run({ discoveryId: 'wdsc_1' })).rejects.toThrow('database exploded');

    expect(lastUpdate()).toMatchObject({
      where: { status: 'running' },
      data: { status: 'pending', leaseExpiresAt: null }
    });
  });
});
