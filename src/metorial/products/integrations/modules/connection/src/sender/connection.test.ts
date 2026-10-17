import { describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: { sessionMessage: { findUnique: vi.fn(), findMany: vi.fn() } }
}));

vi.mock('@metorial-subspace/db', () => ({ db: mocks.db }));
vi.mock('../lib/nats', () => ({
  broadcastNats: {
    subscribe: () => ({ unsubscribe: vi.fn(), async *[Symbol.asyncIterator]() {} })
  }
}));
vi.mock('../lib/topic', () => ({ topics: { sessionConnection: { encode: () => 'topic' } } }));
vi.mock('./manager', () => ({ SenderManager: class {} }));

import { SenderConnection } from './connection';

let connection = { oid: 7n };

let createListener = (replayFromMessageId: string) => {
  let sender = new (SenderConnection as any)({ connection, session: { oid: 1n } });
  return sender.listener({ replayFromMessageId });
};

let collect = async (iterable: AsyncIterable<any>) => {
  let items = [];
  for await (let item of iterable) items.push(item);
  return items;
};

describe('SenderConnection replay', () => {
  it('replays only messages of the same connection, after the anchor', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue({ oid: 100n, connectionOid: 7n });
    mocks.db.sessionMessage.findMany.mockResolvedValueOnce([
      { oid: 101n, status: 'succeeded', completedAt: new Date(), output: { a: 1 } }
    ]);

    let items = await collect(createListener('msg_anchor'));

    expect(mocks.db.sessionMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          connectionOid: 7n,
          oid: { gt: 100n },
          status: { not: 'waiting_for_response' }
        }
      })
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ channel: 'targeted_response', output: { a: 1 } });
  });

  it('rejects an anchor message from another connection', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue({ oid: 100n, connectionOid: 8n });

    await expect(collect(createListener('msg_other'))).rejects.toThrow(
      'Invalid last message ID for replay'
    );
  });
});
