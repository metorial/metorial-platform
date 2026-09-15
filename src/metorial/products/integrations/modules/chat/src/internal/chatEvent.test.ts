import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  metorialDb,
  safeParse,
  getEventPayload,
  buildChatEventPayload,
  upsertChatChannels,
  upsertChatThreads,
  persistMessageResult,
  tombstoneChatMessage,
  recordChatEvent
} = vi.hoisted(() => {
  let createModel = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  });

  return {
    db: {
      callbackEvent: createModel(),
      chatInstanceProvider: createModel(),
      chatWorkspace: createModel(),
      chat: createModel(),
      chatChannel: createModel(),
      chatThread: createModel(),
      chatMessage: createModel(),
      chatAuthor: createModel(),
      chatEvent: createModel(),
      chatConnection: createModel()
    },
    metorialDb: { instance: createModel() },
    safeParse: vi.fn(),
    getEventPayload: vi.fn(),
    buildChatEventPayload: vi.fn(),
    upsertChatChannels: vi.fn(),
    upsertChatThreads: vi.fn(),
    persistMessageResult: vi.fn(),
    tombstoneChatMessage: vi.fn(),
    recordChatEvent: vi.fn()
  };
});

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial-subspace/adapter-chat', () => ({
  chatTriggers: {
    messageReceived: { key: 'chat.message.received', output: { safeParse } }
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db,
  getId: (model: string) => ({ id: `${model}_new`, oid: BigInt(800) }),
  withTransaction: async (fn: (db: any) => Promise<any>) => await fn(db)
}));

vi.mock('@metorial/db', () => ({ db: metorialDb }));

vi.mock('@metorial/module-event-tracker', () => ({
  eventTrackerService: { recordChatEvent }
}));

vi.mock('@metorial-subspace/module-callback', () => ({
  callbackEventInternalService: { getEventPayload }
}));

vi.mock('../lib/chatLock', () => ({
  usingChatMessageLock: (_chatOid: bigint, fn: () => Promise<unknown>) => fn()
}));

vi.mock('./chatEventPayload', () => ({
  chatEventPayloadServiceInternal: { buildChatEventPayload }
}));

vi.mock('./chatChannel', () => ({
  chatChannelServiceInternal: { upsertChatChannels }
}));

vi.mock('./chatThread', () => ({
  chatThreadServiceInternal: { upsertChatThreads }
}));

vi.mock('./chatMessage', () => ({
  chatMessageServiceInternal: { persistMessageResult, tombstoneChatMessage }
}));

import { chatEventInternalService } from './chatEvent';

let chat = { oid: BigInt(5), id: 'cht_1' };
let channel = { oid: BigInt(50), id: 'chc_1', channelId: 'C1' };

let provider = {
  oid: BigInt(80),
  id: 'ciip_1',
  chatConnectionOid: BigInt(10),
  chatInstanceOid: BigInt(20),
  tenantOid: BigInt(1),
  projectOid: BigInt(11),
  environmentOid: BigInt(2),
  instanceOid: BigInt(33),
  solutionOid: 2
};

let callbackEvent = (overrides: Record<string, any> = {}) => ({
  id: 'cbe_1',
  oid: BigInt(900),
  source: 'webhook',
  occurredAt: new Date('2026-02-01T10:00:00Z'),
  providerTriggerKey: 'chat.message.received',
  callback: {
    ownership: 'managed',
    managedAdapterGlobal: { identifier: 'chat' },
    ...(overrides.callback ?? {})
  },
  callbackInstance: { integrationInstanceProviderOid: BigInt(12) },
  tenant: { oid: BigInt(1), id: 'ten_1' },
  environment: { oid: BigInt(2), id: 'env_1' },
  ...overrides
});

let parsedPayload = {
  type: 'chat.message.received',
  id: 'evt_1',
  channel: { id: 'C1', workspaceId: 'T1' }
};

describe('chatEventInternalService.ingestCallbackEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    db.callbackEvent.findUnique.mockResolvedValue(callbackEvent());
    db.chatInstanceProvider.findMany.mockResolvedValue([provider]);
    db.chatWorkspace.findUnique.mockResolvedValue({ chat });
    db.chatAuthor.findUnique.mockResolvedValue(null);
    db.chatEvent.create.mockResolvedValue({
      id: 'che_1',
      oid: BigInt(800),
      type: parsedPayload.type,
      instanceOid: BigInt(33)
    });
    db.chatConnection.findUniqueOrThrow.mockResolvedValue({ id: 'chi_1' });
    metorialDb.instance.findUnique.mockResolvedValue({
      oid: BigInt(33),
      organizationOid: BigInt(4)
    });

    upsertChatChannels.mockResolvedValue([channel]);
    getEventPayload.mockResolvedValue({ raw: true });
    safeParse.mockReturnValue({ success: true, data: parsedPayload });
    buildChatEventPayload.mockResolvedValue({});
  });

  it('records the chat event for a managed chat callback', async () => {
    await chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' });

    expect(db.chatEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'chat.message.received',
        source: 'webhook',
        providerEventId: 'evt_1',
        chatOid: BigInt(5),
        chatInstanceProviderOid: BigInt(80),
        channelOid: BigInt(50),
        callbackEventOid: BigInt(900)
      })
    });
    expect(recordChatEvent).toHaveBeenCalledWith(
      expect.objectContaining({ chatEventId: 'che_1', chatIntegrationId: 'chi_1' })
    );
  });

  it('ignores a callback that is not managed by an adapter', async () => {
    db.callbackEvent.findUnique.mockResolvedValue(
      callbackEvent({ callback: { ownership: 'user', managedAdapterGlobal: null } })
    );

    await chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' });

    expect(getEventPayload).not.toHaveBeenCalled();
    expect(db.chatEvent.create).not.toHaveBeenCalled();
  });

  it('ignores a managed callback owned by another adapter', async () => {
    db.callbackEvent.findUnique.mockResolvedValue(
      callbackEvent({
        callback: { ownership: 'managed', managedAdapterGlobal: { identifier: 'monitor' } }
      })
    );

    await chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' });

    expect(getEventPayload).not.toHaveBeenCalled();
    expect(db.chatEvent.create).not.toHaveBeenCalled();
  });

  it('drops an event whose trigger key the chat adapter does not know', async () => {
    db.callbackEvent.findUnique.mockResolvedValue(
      callbackEvent({ providerTriggerKey: 'chat.unknown.trigger' })
    );

    await expect(
      chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' })
    ).resolves.toBeUndefined();

    expect(db.chatInstanceProvider.findMany).not.toHaveBeenCalled();
    expect(db.chatEvent.create).not.toHaveBeenCalled();
  });

  it('drops an event whose payload does not match the trigger schema', async () => {
    safeParse.mockReturnValue({ success: false, error: { issues: [] } });

    await expect(
      chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' })
    ).resolves.toBeUndefined();

    expect(safeParse).toHaveBeenCalledWith({ raw: true });
    expect(db.chatEvent.create).not.toHaveBeenCalled();
  });

  it('drops an event the provider has no payload for', async () => {
    getEventPayload.mockResolvedValue(null);

    await chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' });

    expect(safeParse).not.toHaveBeenCalled();
    expect(db.chatEvent.create).not.toHaveBeenCalled();
  });

  it('ignores an event whose callback instance has no active chat provider', async () => {
    db.chatInstanceProvider.findMany.mockResolvedValue([]);

    await chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' });

    expect(getEventPayload).not.toHaveBeenCalled();
    expect(db.chatEvent.create).not.toHaveBeenCalled();
  });

  it('skips a provider whose workspace maps to no chat', async () => {
    db.chatWorkspace.findUnique.mockResolvedValue(null);

    await chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' });

    expect(db.chatEvent.create).not.toHaveBeenCalled();
  });

  it('stays a no-op when the same callback event is replayed', async () => {
    db.chatEvent.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' })
    ).resolves.toBeUndefined();

    expect(recordChatEvent).not.toHaveBeenCalled();
  });

  it('propagates a write failure that is not a replay', async () => {
    db.chatEvent.create.mockRejectedValue({ code: 'P2003' });

    await expect(
      chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_1' })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('does nothing when the callback event no longer exists', async () => {
    db.callbackEvent.findUnique.mockResolvedValue(null);

    await chatEventInternalService.ingestCallbackEvent({ callbackEventId: 'cbe_gone' });

    expect(db.chatInstanceProvider.findMany).not.toHaveBeenCalled();
  });
});

describe('chatEventInternalService.recordInvocationFailedEvent', () => {
  it('links the failure to the provider session message', async () => {
    db.chatEvent.create.mockResolvedValue({ id: 'che_1' });

    await chatEventInternalService.recordInvocationFailedEvent({
      sessionMessageOid: BigInt(700),
      operation: 'message.send',
      error: { code: 'chat.provider.error', message: 'Provider call failed' },
      tenantOid: provider.tenantOid,
      projectOid: provider.projectOid,
      environmentOid: provider.environmentOid,
      instanceOid: provider.instanceOid,
      solutionOid: provider.solutionOid,
      chatConnectionOid: provider.chatConnectionOid,
      chatInstanceOid: provider.chatInstanceOid,
      chatInstanceProviderOid: provider.oid,
      chatOid: chat.oid
    });

    expect(db.chatEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'chat.invocation.failed',
        source: 'internal',
        sessionMessageOid: BigInt(700),
        payload: {
          operation: 'message.send',
          error: { code: 'chat.provider.error', message: 'Provider call failed' }
        }
      })
    });
    expect(db.chatEvent.create.mock.calls[0]![0].data).not.toHaveProperty('invocationId');
  });
});
