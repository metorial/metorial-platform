import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => {
  let handlerRef: { current: any } = { current: null };

  return {
    handlerRef,
    db: { sessionMessage: { findUnique: vi.fn() } },
    add: vi.fn(),
    completeMessage: vi.fn(),
    publish: vi.fn()
  };
});

vi.mock('@lowerdeck/queue', () => ({
  QueueRetryError: class extends Error {},
  createQueue: () => ({
    add: mocks.add,
    process: (handler: any) => {
      mocks.handlerRef.current = handler;
      return { handler };
    }
  })
}));
vi.mock('@metorial-subspace/db', () => ({ dbPrimary: mocks.db }));
vi.mock('../../env', () => ({ env: { service: { REDIS_URL: 'redis://localhost:6379' } } }));
vi.mock('../../lib/nats', () => ({ broadcastNats: { publish: mocks.publish } }));
vi.mock('../../lib/topic', () => ({
  topics: {
    sessionConnection: { encode: () => 'session-connection' },
    mcpConnection: { encode: () => 'mcp-connection' }
  }
}));
vi.mock('../../shared/completeMessage', () => ({ completeMessage: mocks.completeMessage }));
vi.mock('../../shared/upsertParticipant', () => ({ upsertParticipant: vi.fn() }));

import './messageTimeout';

let waitingMessage = {
  id: 'msg_1',
  status: 'waiting_for_response',
  source: 'client',
  transport: 'mcp',
  createdAt: new Date(),
  session: { id: 'ses_1' },
  connection: null
};

let run = (data: { messageId: string; attempt?: number }) => mocks.handlerRef.current(data);

describe('messageTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.add.mockResolvedValue(undefined);
    mocks.db.sessionMessage.findUnique.mockResolvedValue(waitingMessage);
  });

  it('gives every re-check hop its own job id', async () => {
    await run({ messageId: 'msg_1', attempt: 0 });

    let next = mocks.add.mock.calls[0]!;
    await run(next[0]);
    await run(mocks.add.mock.calls[1]![0]);

    let ids = mocks.add.mock.calls.map(call => call[1].id);
    expect(ids).toEqual(['msg_1:timeout:1', 'msg_1:timeout:2', 'msg_1:timeout:3']);
    expect(new Set(ids).size).toBe(3);
  });

  it('continues chains enqueued before the attempt counter existed', async () => {
    await run({ messageId: 'msg_1' });

    expect(mocks.add).toHaveBeenCalledWith(
      { messageId: 'msg_1', attempt: 1 },
      expect.objectContaining({ id: 'msg_1:timeout:1' })
    );
  });

  it('stops once the message has completed', async () => {
    mocks.db.sessionMessage.findUnique.mockResolvedValue({
      ...waitingMessage,
      status: 'succeeded'
    });

    await run({ messageId: 'msg_1', attempt: 4 });

    expect(mocks.add).not.toHaveBeenCalled();
    expect(mocks.completeMessage).not.toHaveBeenCalled();
  });

  describe('after the fallback timeout elapsed', () => {
    let expiredAt = new Date(Date.now() - 21 * 60 * 1000);

    beforeEach(() => {
      mocks.completeMessage.mockResolvedValue({
        id: 'msg_1',
        status: 'failed',
        output: { type: 'error', data: { code: 'timeout' } },
        completedAt: new Date()
      });
    });

    it('sends the timeout to the MCP client for client requests', async () => {
      mocks.db.sessionMessage.findUnique.mockResolvedValue({
        ...waitingMessage,
        createdAt: expiredAt,
        connection: { id: 'con_1' }
      });

      await run({ messageId: 'msg_1', attempt: 20 });

      expect(mocks.completeMessage).toHaveBeenCalled();

      let publishedTopics = mocks.publish.mock.calls.map(call => call[0]);
      expect(publishedTopics).toEqual(['session-connection', 'mcp-connection']);
    });

    it('does not send a JSON-RPC error to the client for provider requests', async () => {
      mocks.db.sessionMessage.findUnique.mockResolvedValue({
        ...waitingMessage,
        source: 'provider',
        createdAt: expiredAt,
        connection: { id: 'con_1' }
      });

      await run({ messageId: 'msg_1', attempt: 20 });

      expect(mocks.completeMessage).toHaveBeenCalled();

      let publishedTopics = mocks.publish.mock.calls.map(call => call[0]);
      expect(publishedTopics).toEqual(['session-connection']);
    });
  });
});
