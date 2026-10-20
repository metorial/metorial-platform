import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  getDiscovery: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  queues: {} as Record<string, { add: any; addManyWithOps: any; processor?: any }>
}));

vi.mock('@metorial/queue', () => ({
  createQueue: (opts: { name: string }) => {
    let queue: { add: any; addManyWithOps: any; processor?: any; process: any } = {
      add: vi.fn(),
      addManyWithOps: vi.fn(),
      process: vi.fn((processor: unknown) => {
        queue.processor = processor;
        return { name: opts.name };
      })
    };

    mocks.queues[opts.name] = queue;
    return queue;
  },
  combineQueueProcessors: vi.fn(processors => processors),
  dailyPacedDelay: vi.fn(() => ({ delay: 1000 }))
}));

vi.mock('@metorial/cron', () => ({
  createCron: vi.fn(() => ({ name: 'cron' }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    consumerClient: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany
    }
  }
}));

vi.mock('@metorial/module-web', () => ({
  webDiscoveryService: {
    discover: mocks.discover,
    getWebDiscoveryById: mocks.getDiscovery
  }
}));

import '../src/queues/reconcileConsumerClientLogos';

let manyName = 'coauth/client/logo/reconcile/many';
let singleName = 'coauth/client/logo/reconcile/single';
let applyName = 'coauth/client/logo/reconcile/apply';

let consumerClient = (overrides: Record<string, unknown> = {}) => ({
  oid: 5n,
  id: 'cc_1',
  clientUri: null,
  logoUri: null,
  logoReconciledAt: null,
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
  ...overrides
});

describe('consumer client logo reconciliation', () => {
  beforeEach(() => {
    mocks.discover.mockReset();
    mocks.getDiscovery.mockReset();
    mocks.findMany.mockReset();
    mocks.findUnique.mockReset();
    mocks.updateMany.mockReset();

    for (let queue of Object.values(mocks.queues)) {
      queue.add.mockReset();
      queue.addManyWithOps.mockReset();
    }
  });

  describe('many', () => {
    it('only selects clients without a logo that were not reconciled', async () => {
      mocks.findMany.mockResolvedValue([{ id: 'cc_1' }, { id: 'cc_2' }]);

      await mocks.queues[manyName]!.processor({});

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { logoReconciledAt: null, logoUri: null, id: undefined },
          select: { id: true }
        })
      );
      expect(mocks.queues[singleName]!.addManyWithOps).toHaveBeenCalledWith([
        { data: { consumerClientId: 'cc_1' }, opts: { id: 'cc_1' } },
        { data: { consumerClientId: 'cc_2' }, opts: { id: 'cc_2' } }
      ]);
      expect(mocks.queues[manyName]!.add).not.toHaveBeenCalled();
    });

    it('continues with a cursor when the page was full', async () => {
      mocks.findMany.mockResolvedValue(
        Array.from({ length: 500 }, (_, index) => ({ id: `cc_${index}` }))
      );

      await mocks.queues[manyName]!.processor({});

      expect(mocks.queues[manyName]!.add).toHaveBeenCalledWith(
        { cursor: 'cc_499' },
        { delay: 1000 }
      );
    });
  });

  describe('single', () => {
    it('starts a discovery for the redirect uri domain and marks the client reconciled', async () => {
      mocks.findUnique.mockResolvedValue(consumerClient());
      mocks.discover.mockResolvedValue({ id: 'wdsc_1' });

      await mocks.queues[singleName]!.processor({ consumerClientId: 'cc_1' });

      expect(mocks.discover).toHaveBeenCalledWith({ url: 'https://claude.ai' });
      expect(mocks.queues[applyName]!.add).toHaveBeenCalledWith(
        { consumerClientId: 'cc_1', discoveryId: 'wdsc_1', attempt: 0 },
        { id: 'cc_1_wdsc_1_0' }
      );
      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { oid: 5n, logoReconciledAt: null },
        data: { logoReconciledAt: expect.any(Date) }
      });
    });

    it('marks localhost and ip clients reconciled without fetching', async () => {
      mocks.findUnique.mockResolvedValue(
        consumerClient({
          redirectUris: ['http://localhost:3000/callback', 'http://127.0.0.1:9000/callback']
        })
      );

      await mocks.queues[singleName]!.processor({ consumerClientId: 'cc_1' });

      expect(mocks.discover).not.toHaveBeenCalled();
      expect(mocks.queues[applyName]!.add).not.toHaveBeenCalled();
      expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    });

    it('does not mark the client reconciled when starting the discovery fails', async () => {
      mocks.findUnique.mockResolvedValue(consumerClient());
      mocks.discover.mockRejectedValue(new Error('redis down'));

      await expect(
        mocks.queues[singleName]!.processor({ consumerClientId: 'cc_1' })
      ).rejects.toThrow('redis down');

      expect(mocks.updateMany).not.toHaveBeenCalled();
    });

    it('skips clients that were reconciled or already have a logo', async () => {
      mocks.findUnique.mockResolvedValueOnce(consumerClient({ logoReconciledAt: new Date() }));
      mocks.findUnique.mockResolvedValueOnce(
        consumerClient({ logoUri: 'https://claude.ai/logo.png' })
      );

      await mocks.queues[singleName]!.processor({ consumerClientId: 'cc_1' });
      await mocks.queues[singleName]!.processor({ consumerClientId: 'cc_1' });

      expect(mocks.discover).not.toHaveBeenCalled();
      expect(mocks.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('apply', () => {
    let payload = { consumerClientId: 'cc_1', discoveryId: 'wdsc_1', attempt: 0 };

    it('stores the discovered logo on a client without one', async () => {
      mocks.getDiscovery.mockResolvedValue({
        status: 'succeeded',
        image: { type: 'url', url: 'https://claude.ai/icon.png' }
      });

      await mocks.queues[applyName]!.processor(payload);

      expect(mocks.updateMany).toHaveBeenCalledWith({
        where: { id: 'cc_1', logoUri: null },
        data: { logoUri: 'https://claude.ai/icon.png' }
      });
    });

    it('polls again with a growing delay while the discovery is in flight', async () => {
      mocks.getDiscovery.mockResolvedValue({ status: 'running' });

      await mocks.queues[applyName]!.processor({ ...payload, attempt: 2 });

      expect(mocks.queues[applyName]!.add).toHaveBeenCalledWith(
        { ...payload, attempt: 3 },
        { id: 'cc_1_wdsc_1_3', delay: 20_000 }
      );
    });

    it('stops polling after the max attempts', async () => {
      mocks.getDiscovery.mockResolvedValue({ status: 'pending' });

      await mocks.queues[applyName]!.processor({ ...payload, attempt: 11 });

      expect(mocks.queues[applyName]!.add).not.toHaveBeenCalled();
    });

    it('does nothing when the discovery failed or found no image', async () => {
      mocks.getDiscovery.mockResolvedValueOnce({ status: 'failed' });
      mocks.getDiscovery.mockResolvedValueOnce({ status: 'succeeded', image: null });

      await mocks.queues[applyName]!.processor(payload);
      await mocks.queues[applyName]!.processor(payload);

      expect(mocks.updateMany).not.toHaveBeenCalled();
    });
  });
});
