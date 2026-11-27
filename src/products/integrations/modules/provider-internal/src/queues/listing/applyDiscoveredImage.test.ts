import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  getDiscovery: vi.fn(),
  findListing: vi.fn(),
  updateListing: vi.fn(),
  listingUpdatedAdd: vi.fn(),
  queues: {} as Record<string, { add: ReturnType<typeof vi.fn>; processor?: any }>
}));

vi.mock('@lowerdeck/queue', () => ({
  createQueue: (opts: { name: string }) => {
    let queue: { add: ReturnType<typeof vi.fn>; processor?: any } = {
      add: vi.fn(),
      process: vi.fn((processor: unknown) => {
        queue.processor = processor;
        return { name: opts.name };
      })
    } as any;
    mocks.queues[opts.name] = queue;
    return queue;
  }
}));

vi.mock('@metorial/module-web', () => ({
  webDiscoveryService: { getWebDiscoveryById: mocks.getDiscovery }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    providerListing: { findFirst: mocks.findListing, updateMany: mocks.updateListing }
  }
}));

vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://test' } } }));
vi.mock('../lifecycle/listing', () => ({
  listingUpdatedQueue: { add: mocks.listingUpdatedAdd }
}));

import { enqueueApplyDiscoveredImage } from './applyDiscoveredImage';

let run = (data: { providerListingId: string; discoveryId: string; attempt: number }) =>
  mocks.queues['sub/pint/listing/applyimg']!.processor(data);

let payload = { providerListingId: 'pl_1', discoveryId: 'wdsc_1', attempt: 0 };
let imageUrl = 'https://cloudflare.com/icon.png';

let listing = (overrides: Record<string, unknown> = {}) => ({
  oid: 5n,
  id: 'pl_1',
  isCustomized: false,
  image: { type: 'default' },
  ...overrides
});

describe('apply discovered image queue', () => {
  beforeEach(() => {
    mocks.getDiscovery.mockReset();
    mocks.findListing.mockReset();
    mocks.updateListing.mockReset();
    mocks.listingUpdatedAdd.mockReset();
    mocks.queues['sub/pint/listing/applyimg']!.add.mockReset();
  });

  let addMock = () => mocks.queues['sub/pint/listing/applyimg']!.add;

  it('polls again with a growing delay while the discovery is in flight', async () => {
    mocks.getDiscovery.mockResolvedValue({ status: 'running' });

    await run({ ...payload, attempt: 2 });

    expect(addMock()).toHaveBeenCalledWith(
      { ...payload, attempt: 3 },
      { id: 'pl_1_wdsc_1_3', delay: 20_000 }
    );
  });

  it('stops polling after the max attempts', async () => {
    mocks.getDiscovery.mockResolvedValue({ status: 'pending' });

    await run({ ...payload, attempt: 11 });

    expect(addMock()).not.toHaveBeenCalled();
  });

  it('stops when the discovery failed', async () => {
    mocks.getDiscovery.mockResolvedValue({ status: 'failed' });

    await run(payload);

    expect(addMock()).not.toHaveBeenCalled();
    expect(mocks.updateListing).not.toHaveBeenCalled();
  });

  it('applies the discovered image to a non-customized listing', async () => {
    mocks.getDiscovery.mockResolvedValue({
      status: 'succeeded',
      image: { type: 'url', url: imageUrl }
    });
    mocks.findListing.mockResolvedValue(listing());

    await run(payload);

    expect(mocks.updateListing).toHaveBeenCalledWith({
      where: { oid: 5n, isCustomized: false },
      data: { image: { type: 'url', url: imageUrl } }
    });
    expect(mocks.listingUpdatedAdd).toHaveBeenCalledWith({ providerListingId: 'pl_1' });
  });

  it('never overwrites a customized listing', async () => {
    mocks.getDiscovery.mockResolvedValue({
      status: 'succeeded',
      image: { type: 'url', url: imageUrl }
    });
    mocks.findListing.mockResolvedValue(listing({ isCustomized: true }));

    await run(payload);

    expect(mocks.updateListing).not.toHaveBeenCalled();
    expect(mocks.listingUpdatedAdd).not.toHaveBeenCalled();
  });

  it('skips the update when the listing already has the image', async () => {
    mocks.getDiscovery.mockResolvedValue({
      status: 'succeeded',
      image: { type: 'url', url: imageUrl }
    });
    mocks.findListing.mockResolvedValue(listing({ image: { type: 'url', url: imageUrl } }));

    await run(payload);

    expect(mocks.updateListing).not.toHaveBeenCalled();
  });

  it('does nothing when the discovery found no image', async () => {
    mocks.getDiscovery.mockResolvedValue({ status: 'succeeded', image: null });

    await run(payload);

    expect(mocks.findListing).not.toHaveBeenCalled();
  });

  it('enqueues with a deduplicating job id', async () => {
    await enqueueApplyDiscoveredImage({ providerListingId: 'pl_1', discoveryId: 'wdsc_1' });

    expect(addMock()).toHaveBeenCalledWith(payload, { id: 'pl_1_wdsc_1_0' });
  });
});
