import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { defineAdapter } from '@slates/adapter';
import { z } from 'zod';

let { db, internalToolCallService } = vi.hoisted(() => ({
  db: {
    sessionProvider: { findMany: vi.fn() },
    providerVersionAdapter: { findMany: vi.fn() }
  },
  internalToolCallService: { call: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({ db }));
vi.mock('@metorial-subspace/module-session', () => ({ internalToolCallService }));

import { AdapterClient } from './client';
import { resetAdvertisedAdapterCapabilitiesCache } from './capabilities';

let EmailAdapter = defineAdapter({
  id: 'email',
  name: 'Email',
  capabilities: {
    send: { tools: ['email.send'] },
    inbound: { triggers: ['email.received'] },
    markdown: {}
  }
});

let sendEmail = EmailAdapter.defineTool({
  key: 'email.send',
  name: 'Send Email',
  input: z.object({ to: z.string() }),
  output: z.object({ id: z.string() })
});

let emailReceived = EmailAdapter.defineTrigger({
  key: 'email.received',
  name: 'Email Received',
  input: z.object({ id: z.string() }),
  output: z.object({ type: z.literal('email.received'), id: z.string() })
});

let linked = EmailAdapter.link({
  tools: { sendEmail },
  triggers: { emailReceived }
});

let params = {
  adapter: linked,
  tenant: { id: 'ten_1', oid: 2n } as any,
  environment: { id: 'env_1', oid: 3n } as any,
  session: { id: 'ses_1', oid: 1n } as any,
  client: { identifier: 'worker', name: 'Worker' }
};

describe('AdapterClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAdvertisedAdapterCapabilitiesCache();
    db.sessionProvider.findMany.mockResolvedValue([
      {
        deployment: {
          currentVersion: { lockedVersionOid: 10n },
          providerVariant: { currentVersionOid: 11n }
        }
      }
    ]);
    db.providerVersionAdapter.findMany.mockResolvedValue([
      {
        providerVersionOid: 10n,
        capabilities: [
          { id: 'send', value: true },
          { id: 'markdown', value: false }
        ]
      }
    ]);
    internalToolCallService.call.mockResolvedValue({
      result: { status: 'success', output: { id: 'msg_1' } },
      message: { id: 'smg_1' },
      connection: { id: 'scn_1' }
    });
  });

  it('loads advertised capabilities and remaps a successful tool call', async () => {
    let client = await AdapterClient.create(params);
    let result = await client.call('email.send', { to: 'a@example.com' });

    expect(db.providerVersionAdapter.findMany).toHaveBeenCalledWith({
      where: {
        providerVersionOid: { in: [10n] },
        adapter: { global: { identifier: 'email' } }
      },
      select: {
        providerVersionOid: true,
        capabilities: true
      }
    });
    expect(internalToolCallService.call).toHaveBeenCalledWith({
      tenant: params.tenant,
      environment: params.environment,
      session: params.session,
      adapter: { identifier: 'email' },
      client: params.client,
      key: 'email.send',
      input: { to: 'a@example.com' }
    });
    expect(result).toEqual({
      result: { type: 'success', output: { id: 'msg_1' } },
      message: { id: 'smg_1' },
      connection: { id: 'scn_1' }
    });
    expect(client.isActionAvailable('email.send')).toBe(true);
    expect(client.isActionAvailable('email.received')).toBe(false);
    expect(client.isCapabilityAvailable('markdown')).toBe(false);

    expectTypeOf(result.result).toHaveProperty('type');
    if (result.result.type === 'success') {
      expectTypeOf(result.result.output).toEqualTypeOf<{ id: string }>();
    }
  });

  it('skips version adapter queries on LRU hits', async () => {
    await AdapterClient.create(params);
    db.providerVersionAdapter.findMany.mockClear();

    await AdapterClient.create(params);

    expect(db.sessionProvider.findMany).toHaveBeenCalledTimes(2);
    expect(db.providerVersionAdapter.findMany).not.toHaveBeenCalled();
  });

  it('merges capabilities from multiple provider versions and prefers enabled values', async () => {
    db.sessionProvider.findMany.mockResolvedValue([
      {
        deployment: {
          currentVersion: { lockedVersionOid: 10n },
          providerVariant: { currentVersionOid: 11n }
        }
      },
      {
        deployment: {
          currentVersion: null,
          providerVariant: { currentVersionOid: 12n }
        }
      }
    ]);
    db.providerVersionAdapter.findMany.mockResolvedValue([
      {
        providerVersionOid: 10n,
        capabilities: [{ id: 'send', value: false }]
      },
      {
        providerVersionOid: 12n,
        capabilities: [
          { id: 'send', value: true },
          { id: 'markdown', value: true }
        ]
      }
    ]);

    let client = await AdapterClient.create(params);

    expect(client.isActionAvailable('email.send')).toBe(true);
    expect(client.isCapabilityAvailable('markdown')).toBe(true);
  });

  it('maps failed tool calls onto a typed failure result', async () => {
    internalToolCallService.call.mockResolvedValue({
      result: {
        status: 'failure',
        output: { code: 'timeout', message: 'Timed out' }
      },
      message: { id: 'smg_2' },
      connection: { id: 'scn_2' }
    });

    let client = await AdapterClient.create(params);
    let result = await client.call('email.send', { to: 'a@example.com' });

    expect(result).toEqual({
      result: { type: 'failure', output: { code: 'timeout', message: 'Timed out' } },
      message: { id: 'smg_2' },
      connection: { id: 'scn_2' }
    });
  });
});
