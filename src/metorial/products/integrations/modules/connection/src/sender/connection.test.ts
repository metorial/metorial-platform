import { describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: { sessionMessage: { findUnique: vi.fn(), findMany: vi.fn() } },
  getOffloadedSessionMessage: vi.fn()
}));

vi.mock('@metorial-subspace/db', () => ({ db: mocks.db }));
vi.mock('@lowerdeck/delay', () => ({ delay: vi.fn() }));
vi.mock('@metorial-subspace/connection-utils', () => ({
  getOffloadedSessionMessage: mocks.getOffloadedSessionMessage
}));
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

  it('reads the output of offloaded messages from storage', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue({ oid: 100n, connectionOid: 7n });
    mocks.db.sessionMessage.findMany.mockResolvedValueOnce([
      {
        id: 'msg_1',
        oid: 101n,
        status: 'succeeded',
        isOffloadedToStorage: true,
        output: null,
        createdAt: new Date(Date.now() - 60 * 60 * 1000)
      }
    ]);
    mocks.getOffloadedSessionMessage.mockResolvedValue({ output: { big: true } });

    let items = await collect(createListener('msg_anchor'));

    expect(mocks.getOffloadedSessionMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg_1' })
    );
    expect(items[0]).toMatchObject({ output: { big: true } });
    expect(items[0].message.output).toEqual({ big: true });
  });

  it('polls storage for recent offloaded messages until the body lands', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValueOnce({ oid: 100n, connectionOid: 7n });
    mocks.db.sessionMessage.findUnique.mockResolvedValue({
      isOffloadedToStorage: true,
      output: null
    });
    mocks.db.sessionMessage.findMany.mockResolvedValueOnce([
      {
        id: 'msg_2',
        oid: 102n,
        status: 'succeeded',
        isOffloadedToStorage: true,
        output: null,
        createdAt: new Date()
      }
    ]);
    mocks.getOffloadedSessionMessage.mockReset();
    mocks.getOffloadedSessionMessage
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ output: { landed: true } });

    let items = await collect(createListener('msg_anchor'));

    expect(mocks.getOffloadedSessionMessage).toHaveBeenCalledTimes(3);
    expect(items[0]).toMatchObject({ output: { landed: true } });
  });

  it('uses the row body when a failed storage write put it back', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValueOnce({ oid: 100n, connectionOid: 7n });
    mocks.db.sessionMessage.findUnique.mockResolvedValue({
      isOffloadedToStorage: false,
      output: { restored: true }
    });
    mocks.db.sessionMessage.findMany.mockResolvedValueOnce([
      {
        id: 'msg_3',
        oid: 103n,
        status: 'succeeded',
        isOffloadedToStorage: true,
        output: null,
        createdAt: new Date()
      }
    ]);
    mocks.getOffloadedSessionMessage.mockReset();
    mocks.getOffloadedSessionMessage.mockResolvedValue(null);

    let items = await collect(createListener('msg_anchor'));

    expect(items[0]).toMatchObject({ output: { restored: true } });
  });

  it('rejects an anchor message from another connection', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue({ oid: 100n, connectionOid: 8n });

    await expect(collect(createListener('msg_other'))).rejects.toThrow(
      'Invalid last message ID for replay'
    );
  });
});
