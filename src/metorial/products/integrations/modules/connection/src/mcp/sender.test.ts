import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  completeMessage: vi.fn(),
  upsertParticipant: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));
vi.mock('@metorial-subspace/db', () => ({
  db: {},
  dbPrimary: { sessionMessage: { findFirst: mocks.findFirst } },
  messageTranslator: { outputToMcpBasic: vi.fn(async () => null) }
}));
vi.mock('@metorial-subspace/connection-utils', () => ({
  checkResourceAccessManager: () => () => ({ allowed: true }),
  conduitResultToMcpMessage: vi.fn(async (result: any) => ({
    jsonrpc: '2.0',
    id: 1,
    error: { code: -32603, message: result.output?.data?.message ?? 'error' }
  })),
  markdownList: () => '',
  mcpValidate: (_id: unknown, _schema: unknown, msg: unknown) => ({ success: true, data: msg })
}));
vi.mock('@metorial-subspace/module-session', () => ({
  applySessionProviderNameTemplate: (_template: string, uri: string) => uri,
  parseNameFromSessionProviderTemplates: vi.fn()
}));
vi.mock('../lib/mcpOutputSchemaNormalizer', () => ({ mcpOutputSchemaNormalizer: vi.fn() }));
vi.mock('../presenter', () => ({ providerToolPresenter: vi.fn() }));
vi.mock('../shared/completeMessage', () => ({ completeMessage: mocks.completeMessage }));
vi.mock('../shared/upsertParticipant', () => ({ upsertParticipant: mocks.upsertParticipant }));
vi.mock('./control', () => ({ getMcpProgressToken: () => null }));

import { McpSender } from './sender';

let parentMessage = { id: 'msg_parent', oid: 1n };

let resourcesListTool = {
  key: 'resources_list',
  value: { mcpToolType: { type: 'mcp.resources_list' } },
  sessionProvider: { id: 'sp_1', nameTemplate: 'slack' }
};

let createManager = () => ({
  session: { oid: 1n, isInternal: false },
  connection: { participant: { oid: 2n } },
  tenant: {},
  createMessage: vi.fn(async () => parentMessage),
  listToolsIncludingInternalAndNonAllowed: vi.fn(async () => ({
    tools: [resourcesListTool]
  })),
  callTool: vi.fn(async () => ({
    status: 'succeeded',
    message: null,
    output: {
      type: 'mcp',
      data: {
        jsonrpc: '2.0',
        id: 'x',
        result: { resources: [{ uri: 'file://a', name: 'a' }] }
      }
    }
  })),
  sendMcpMessageToProvider: vi.fn(async () => undefined)
});

let createSender = (manager: ReturnType<typeof createManager>) => {
  let control = { sendControlMessage: vi.fn(async () => undefined) };
  let sender = new McpSender('streamable_http', manager as any, control as any);

  return { sender, control };
};

let resourcesListRequest = (params: Record<string, any> = {}) => ({
  jsonrpc: '2.0' as const,
  id: 1,
  method: 'resources/list',
  params
});

describe('McpSender resources/list', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.upsertParticipant.mockResolvedValue({ oid: 3n });
    mocks.completeMessage.mockImplementation(async (_filter, data) => ({
      ...parentMessage,
      status: data.status,
      output: data.output,
      completedAt: new Date()
    }));
  });

  it('completes the parent message and broadcasts the response', async () => {
    let manager = createManager();
    let { sender, control } = createSender(manager);

    let res = await sender.handleMessage(resourcesListRequest(), { waitForResponse: false });

    expect(mocks.completeMessage).toHaveBeenCalledWith(
      { messageId: 'msg_parent' },
      expect.objectContaining({
        status: 'succeeded',
        output: { type: 'mcp', data: res?.mcp }
      })
    );
    expect(res?.mcp).toMatchObject({ result: { resources: [{ uri: 'file://a' }] } });

    expect(manager.createMessage).toHaveBeenCalledTimes(1);
    expect(control.sendControlMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'targeted_response' })
    );
  });

  it('completes the parent message as failed for an invalid cursor', async () => {
    let manager = createManager();
    let { sender } = createSender(manager);

    let res = await sender.handleMessage(resourcesListRequest({ cursor: 'not-a-cursor' }), {
      waitForResponse: true
    });

    expect(res?.mcp).toMatchObject({ error: { message: 'Invalid cursor' } });
    expect(mocks.completeMessage).toHaveBeenCalledWith(
      { messageId: 'msg_parent' },
      expect.objectContaining({ status: 'failed' })
    );
    expect(manager.createMessage).toHaveBeenCalledTimes(1);
  });

  it('completes the parent message without a duplicate when a provider call throws', async () => {
    let manager = createManager();
    manager.callTool.mockRejectedValue(new Error('boom'));
    let { sender } = createSender(manager);

    let res = await sender.handleMessage(resourcesListRequest(), { waitForResponse: true });

    expect(res?.mcp).toMatchObject({ error: expect.any(Object) });
    expect(mocks.completeMessage).toHaveBeenCalledWith(
      { messageId: 'msg_parent' },
      expect.objectContaining({ status: 'failed', failureReason: 'system_error' })
    );
    expect(manager.createMessage).toHaveBeenCalledTimes(1);
  });
});

describe('McpSender client responses to provider requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the response to the provider that sent the request', async () => {
    let providerRequest = { id: 'msg_provider', providerMcpId: 'smsg_1' };
    mocks.findFirst.mockResolvedValue(providerRequest);

    let manager = createManager();
    let { sender } = createSender(manager);

    let reply = { jsonrpc: '2.0' as const, id: 'smsg_1', result: { action: 'accept' } };
    let res = await sender.handleMessage(reply, { waitForResponse: false });

    expect(res).toBeNull();
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        sessionOid: 1n,
        providerMcpId: 'smsg_1',
        source: 'provider',
        status: 'waiting_for_response'
      }
    });
    expect(manager.sendMcpMessageToProvider).toHaveBeenCalledWith({
      message: providerRequest,
      mcpMessage: reply
    });
  });

  it('ignores responses that match no pending provider request', async () => {
    mocks.findFirst.mockResolvedValue(null);

    let manager = createManager();
    let { sender } = createSender(manager);

    let res = await sender.handleMessage(
      { jsonrpc: '2.0', id: 'smsg_unknown', result: {} },
      { waitForResponse: false }
    );

    expect(res).toBeNull();
    expect(manager.sendMcpMessageToProvider).not.toHaveBeenCalled();
  });
});
