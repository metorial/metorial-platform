import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

let { db, internalToolCallService } = vi.hoisted(() => ({
  db: {
    sessionProvider: { findMany: vi.fn() },
    providerVersionAdapter: { findMany: vi.fn() }
  },
  internalToolCallService: { call: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial-subspace/module-session', () => ({ internalToolCallService }));

import { ChatAdapterClient } from './index';

describe('ChatAdapterClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sessionProvider.findMany.mockResolvedValue([]);
    db.providerVersionAdapter.findMany.mockResolvedValue([]);
    internalToolCallService.call.mockResolvedValue({
      result: {
        status: 'success',
        output: { message: { id: 'm1', channelId: 'C1' } }
      },
      message: { id: 'smg_1' },
      connection: { id: 'scn_1' }
    });
  });

  it('calls the chat adapter through the internal tool call service', async () => {
    let client = await ChatAdapterClient.create({
      tenant: { id: 'ten_1', oid: 2n } as any,
      environment: { id: 'env_1', oid: 3n } as any,
      session: { id: 'ses_1', oid: 1n } as any,
      client: { identifier: 'worker', name: 'Worker' }
    });

    let result = await client.call('metorial_chat$message.send', {
      channelId: 'C1',
      parts: [{ type: 'markdown', markdown: 'hello' }]
    });

    expect(internalToolCallService.call).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: { identifier: 'chat' },
        key: 'metorial_chat$message.send',
        input: {
          channelId: 'C1',
          parts: [{ type: 'markdown', markdown: 'hello' }]
        }
      })
    );
    expect(result.result.type).toBe('success');

    type SendInput = Parameters<typeof client.call<'metorial_chat$message.send'>>[1];
    expectTypeOf<SendInput['channelId']>().toEqualTypeOf<string>();
  });
});
