import { describe, expect, it, vi } from 'vitest';

let { subscribers } = vi.hoisted(() => ({
  subscribers: new Set<(data: Uint8Array) => void>()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: vi.fn(() => ({ captureException: vi.fn() }))
}));
vi.mock('@metorial-subspace/connection-utils', () => ({
  conduitResultToMcpMessage: vi.fn(async (result: any) => result.output?.data ?? null)
}));
vi.mock('../lib/topic', () => ({
  topics: { mcpConnection: { encode: () => 'shared-connection-topic' } }
}));
vi.mock('../lib/nats', () => ({
  broadcastNats: {
    publish: async (_topic: string, payload: string) => {
      let data = new TextEncoder().encode(payload);
      for (let subscriber of subscribers) subscriber(data);
    },
    subscribe: () => {
      let queue: { data: Uint8Array }[] = [];
      let wake: (() => void) | null = null;
      let closed = false;
      let push = (data: Uint8Array) => {
        queue.push({ data });
        wake?.();
      };
      subscribers.add(push);

      return {
        unsubscribe: () => {
          closed = true;
          subscribers.delete(push);
          wake?.();
        },
        async *[Symbol.asyncIterator]() {
          while (!closed) {
            if (!queue.length) await new Promise<void>(resolve => (wake = resolve));
            while (queue.length) yield queue.shift()!;
          }
        }
      };
    }
  }
}));
vi.mock('./manager', () => ({
  McpManager: {
    create: vi.fn(async () => ({
      session: { id: 'ses_1' },
      connection: { id: 'scon_shared' },
      getConnection: async () => ({ id: 'scon_shared' })
    }))
  }
}));
vi.mock('./sender', () => ({
  McpSender: class {
    constructor(
      _transport: string,
      _manager: unknown,
      private control: any
    ) {}

    async handleMessage(msg: any) {
      await this.control.sendControlMessage({
        type: 'mcp_control_message',
        channel: 'broadcast_response_or_notification',
        requestNonce: this.control.requestNonce,
        conduit: {
          status: 'succeeded',
          message: null,
          completedAt: null,
          output: {
            type: 'mcp',
            data: {
              jsonrpc: '2.0',
              method: 'notifications/progress',
              params: { progressToken: 'shared-token', progress: 1, message: msg.id }
            }
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 20));
      return { message: null, mcp: { jsonrpc: '2.0', id: msg.id, result: {} } };
    }
  }
}));

import { McpConnection } from './connection';

let request = (id: string) => ({
  jsonrpc: '2.0' as const,
  id,
  method: 'tools/call',
  params: { name: 'search', _meta: { progressToken: 'shared-token' } }
});

describe('McpConnection.handleMessageWithProgress', () => {
  it('only forwards progress from its own request on a shared connection', async () => {
    let first = await McpConnection.create({
      sessionId: 'ses_1',
      solutionId: 'sol_1',
      tenantId: 'ten_1',
      mcpTransport: 'sessionless'
    });
    let second = await McpConnection.create({
      sessionId: 'ses_1',
      solutionId: 'sol_1',
      tenantId: 'ten_1',
      mcpTransport: 'sessionless'
    });

    let firstProgress = vi.fn();
    let secondProgress = vi.fn();

    await Promise.all([
      first.handleMessageWithProgress(request('a'), { waitForResponse: true }, firstProgress),
      second.handleMessageWithProgress(request('b'), { waitForResponse: true }, secondProgress)
    ]);

    expect(firstProgress).toHaveBeenCalledTimes(1);
    expect(firstProgress.mock.calls[0]![0].mcp.params.message).toBe('a');
    expect(secondProgress).toHaveBeenCalledTimes(1);
    expect(secondProgress.mock.calls[0]![0].mcp.params.message).toBe('b');
  });
});
