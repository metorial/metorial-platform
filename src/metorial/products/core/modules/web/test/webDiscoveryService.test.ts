import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  generateId: vi.fn(async () => 'wdsc_new'),
  enqueue: vi.fn(async () => ({}))
}));

vi.mock('@metorial/db', () => ({
  db: {
    webDiscovery: {
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
      findUniqueOrThrow: mocks.findUniqueOrThrow
    }
  },
  ID: { generateId: mocks.generateId }
}));

vi.mock('../src/queues/discovery', () => ({ runDiscoveryQueue: { add: mocks.enqueue } }));

import { DISCOVERY_REUSE_WINDOW_MS } from '../src/lib/limits';
import { webDiscoveryService } from '../src/services/webDiscovery';

let hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

let row = (overrides: Record<string, unknown> = {}) => ({
  oid: 1n,
  id: 'wdsc_existing',
  status: 'succeeded',
  startedAt: hoursAgo(1),
  ...overrides
});

describe('webDiscoveryService.discover', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockClear());
  });

  let url = 'https://docs.mcp.cloudflare.com/mcp?key=secret';

  it('creates a row and enqueues a run for a new url', async () => {
    mocks.upsert.mockResolvedValue(row({ id: 'wdsc_new', status: 'pending' }));

    let discovery = await webDiscoveryService.discover({ url });

    expect(discovery.id).toBe('wdsc_new');
    expect(mocks.upsert.mock.calls[0]![0]).toMatchObject({
      where: { urlKey: 'docs.mcp.cloudflare.com/mcp' },
      create: {
        url: 'https://docs.mcp.cloudflare.com/mcp',
        registrableDomain: 'cloudflare.com'
      }
    });
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it('reuses a succeeded discovery from the last 24 hours', async () => {
    mocks.upsert.mockResolvedValue(row({ status: 'succeeded', startedAt: hoursAgo(23) }));

    let discovery = await webDiscoveryService.discover({ url });

    expect(discovery.id).toBe('wdsc_existing');
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it.each(['pending', 'running'])('shares an in-flight %s discovery', async status => {
    mocks.upsert.mockResolvedValue(row({ status, startedAt: hoursAgo(0.1) }));

    await webDiscoveryService.discover({ url });

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('re-runs a failed discovery even inside the window', async () => {
    mocks.upsert.mockResolvedValue(row({ status: 'failed', startedAt: hoursAgo(1) }));
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue(
      row({ status: 'pending', startedAt: new Date() })
    );

    await webDiscoveryService.discover({ url });

    expect(mocks.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { oid: 1n, OR: [{ status: 'failed' }, { startedAt: { lt: expect.any(Date) } }] },
      data: { status: 'pending', attempts: 0, errorCode: null }
    });
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it('re-runs a succeeded discovery older than 24 hours', async () => {
    let age = DISCOVERY_REUSE_WINDOW_MS / (60 * 60 * 1000) + 1;
    mocks.upsert.mockResolvedValue(row({ status: 'succeeded', startedAt: hoursAgo(age) }));
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue(
      row({ status: 'pending', startedAt: new Date() })
    );

    await webDiscoveryService.discover({ url });

    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue twice when a concurrent caller already reset the row', async () => {
    mocks.upsert.mockResolvedValue(row({ status: 'failed' }));
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await webDiscoveryService.discover({ url });

    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('rejects invalid urls', async () => {
    await expect(webDiscoveryService.discover({ url: 'ftp://nope' })).rejects.toThrow();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe('webDiscoveryService.isTerminal', () => {
  it('only treats succeeded and failed as terminal', () => {
    expect(webDiscoveryService.isTerminal({ status: 'succeeded' })).toBe(true);
    expect(webDiscoveryService.isTerminal({ status: 'failed' })).toBe(true);
    expect(webDiscoveryService.isTerminal({ status: 'pending' })).toBe(false);
    expect(webDiscoveryService.isTerminal({ status: 'running' })).toBe(false);
  });
});
