import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  completeMessage: vi.fn(),
  upsertParticipant: vi.fn(async () => ({ oid: 1n, id: 'spar_system' }))
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));
vi.mock('@metorial-subspace/db', () => ({
  db: { sessionMessage: { findFirst: mocks.findFirst } },
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
  mcpValidate: (id: any, schema: any, data: unknown) => {
    let res = schema.safeParse(data);
    if (res.success) return { success: true, data: res.data };

    return {
      success: false,
      error: { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid params' } }
    };
  }
}));
vi.mock('@metorial-subspace/module-session', () => ({
  applySessionProviderNameTemplate: (_template: string, uri: string) => uri,
  parseNameFromSessionProviderTemplates: vi.fn()
}));
vi.mock('../lib/mcpOutputSchemaNormalizer', () => ({ mcpOutputSchemaNormalizer: vi.fn() }));
vi.mock('../presenter', () => ({ providerToolPresenter: vi.fn() }));
vi.mock('../shared/completeMessage', () => ({ completeMessage: mocks.completeMessage }));
vi.mock('../shared/upsertParticipant', () => ({ upsertParticipant: mocks.upsertParticipant }));
vi.mock('../shared/toolCallOperation', () => ({
  injectToolCallOperationIntoInputSchema: vi.fn()
}));
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
  sendMcpMessageToProvider: vi.fn(async () => undefined),
  getRequestSkills: vi.fn(async () => null)
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

    mocks.upsertParticipant.mockResolvedValue({ oid: 3n, id: 'spar_3' });
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

  it('forwards the response without the Codex turn metadata', async () => {
    let providerRequest = { id: 'msg_provider', providerMcpId: 'smsg_2' };
    mocks.findFirst.mockResolvedValue(providerRequest);

    let manager = createManager();
    let { sender } = createSender(manager);

    await sender.handleMessage(
      {
        jsonrpc: '2.0',
        id: 'smsg_2',
        result: {
          action: 'accept',
          _meta: { progressToken: 5, 'x-codex-turn-metadata': { turn_id: 'turn-1' } }
        }
      },
      { waitForResponse: false }
    );

    expect(manager.sendMcpMessageToProvider).toHaveBeenCalledWith({
      message: providerRequest,
      mcpMessage: {
        jsonrpc: '2.0',
        id: 'smsg_2',
        result: { action: 'accept', _meta: { progressToken: 5 } }
      }
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

let createRedactionSender = (d: {
  redactedToolKeys: string[];
  callTool?: () => Promise<any>;
}) => {
  let createMessage = vi.fn(async (props: any) => ({
    id: 'smsg_1',
    status: props.status,
    output: props.output,
    completedAt: null
  }));

  let manager = {
    session: { oid: 1n, id: 'ses_1', isInternal: false },
    connection: { participant: { oid: 2n, id: 'spar_client' } },
    tenant: {},
    shouldRedactStoredToolInput: vi.fn(async (key: string) =>
      d.redactedToolKeys.includes(key)
    ),
    callTool: vi.fn(d.callTool ?? (async () => ({}))),
    createMessage
  };

  let control = { sendControlMessage: vi.fn(async () => {}) };
  let sender = new McpSender('streamable_http' as any, manager as any, control as any);

  return { sender, createMessage };
};

let writeFileCall = (args: unknown) => ({
  jsonrpc: '2.0' as const,
  id: 7,
  method: 'tools/call',
  params: { name: 'metorial_skill_write_file', arguments: args }
});

describe('McpSender stored tool call input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('redacts malformed request tool calls before storing them', async () => {
    let { sender, createMessage } = createRedactionSender({
      redactedToolKeys: ['metorial_skill_write_file']
    });

    await sender.handleMessage(writeFileCall('secret skill content') as any, {
      waitForResponse: true
    });

    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(createMessage.mock.calls[0]![0].input).toEqual({
      type: 'mcp',
      data: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'metorial_skill_write_file', redacted: true }
      }
    });
  });

  it('redacts request tool calls whose execution throws', async () => {
    let { sender, createMessage } = createRedactionSender({
      redactedToolKeys: ['metorial_skill_write_file'],
      callTool: async () => {
        throw new Error('boom');
      }
    });

    await sender.handleMessage(
      writeFileCall({ skill: 'skill_1', path: '/SKILL.md', content: 'secret' }) as any,
      { waitForResponse: true }
    );

    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(createMessage.mock.calls[0]![0]).toMatchObject({
      type: 'unknown',
      failureReason: 'system_error',
      input: { data: { params: { name: 'metorial_skill_write_file', redacted: true } } }
    });
    expect(JSON.stringify(createMessage.mock.calls[0]![0].input)).not.toContain('secret');
  });

  it('redacts tool calls without a tool name', async () => {
    let { sender, createMessage } = createRedactionSender({ redactedToolKeys: [] });

    await sender.handleMessage(
      {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 42, arguments: { content: 'secret' } }
      } as any,
      { waitForResponse: true }
    );

    expect(createMessage.mock.calls[0]![0].input).toEqual({
      type: 'mcp',
      data: { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { redacted: true } }
    });
  });

  it('keeps the raw input for other tools', async () => {
    let { sender, createMessage } = createRedactionSender({ redactedToolKeys: [] });
    let msg = {
      jsonrpc: '2.0' as const,
      id: 8,
      method: 'tools/call',
      params: { name: 'provider_tool', arguments: 'not an object' }
    };

    await sender.handleMessage(msg as any, { waitForResponse: true });

    expect(createMessage.mock.calls[0]![0].input).toEqual({ type: 'mcp', data: msg });
  });
});

let createClientCallSender = (
  d: { clientName?: string; callTool?: () => Promise<any> } = {}
) => {
  let createMessage = vi.fn(async (props: any) => ({
    id: 'smsg_1',
    status: props.status,
    output: props.output,
    completedAt: null
  }));

  let manager = {
    session: { oid: 1n, id: 'ses_1', isInternal: false },
    connection: {
      participant: { oid: 2n, id: 'spar_client' },
      mcpData: { clientInfo: { name: d.clientName ?? 'unknown-client', version: '1.0.0' } }
    },
    tenant: {},
    shouldRedactStoredToolInput: vi.fn(async () => false),
    callTool: vi.fn(
      d.callTool ??
        (async () => ({ status: 'succeeded', message: { id: 'smsg_1' }, output: null }))
    ),
    createMessage,
    listToolsIncludingInternalAndNonAllowed: vi.fn(async () => ({
      tools: [resourcesListTool]
    })),
    getRequestSkills: vi.fn(async () => null)
  };

  let control = { sendControlMessage: vi.fn(async () => {}) };
  let sender = new McpSender('streamable_http' as any, manager as any, control as any);

  return { sender, manager, createMessage };
};

let codexTurnMetadata = {
  session_id: 'session-1',
  turn_id: 'turn-1',
  workspaces: {
    '/home/dev/project': {
      associated_remote_urls: ['git@example.com:org/repo.git'],
      latest_git_commit_hash: 'abc123',
      has_changes: true
    }
  }
};

let metaToolCall = (meta: Record<string, unknown>) => ({
  jsonrpc: '2.0' as const,
  id: 11,
  method: 'tools/call',
  params: { name: 'search', arguments: { query: 'x' }, _meta: meta }
});

describe('McpSender client call ids', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('passes the Claude Code tool use id to the tool call', async () => {
    let { sender, manager } = createClientCallSender({ clientName: 'claude-code' });

    await sender.handleMessage(
      metaToolCall({ 'claudecode/toolUseId': 'toolu_01abc', progressToken: 4 }),
      { waitForResponse: true }
    );

    expect(manager.callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        clientCall: { id: 'toolu_01abc', source: 'claude-code' },
        input: {
          type: 'mcp',
          data: expect.objectContaining({
            params: expect.objectContaining({
              _meta: { 'claudecode/toolUseId': 'toolu_01abc', progressToken: 4 }
            })
          })
        }
      })
    );
  });

  it('passes the Codex call id and forwards the call without the turn metadata', async () => {
    let { sender, manager } = createClientCallSender({ clientName: 'some-client' });

    await sender.handleMessage(
      metaToolCall({
        callId: 'call_abc',
        threadId: 'thread-1',
        progressToken: 'p-1',
        'x-codex-turn-metadata': codexTurnMetadata
      }),
      { waitForResponse: true }
    );

    let props = (manager.callTool.mock.calls as any[][])[0]![0];
    expect(props.clientCall).toEqual({ id: 'call_abc', source: 'codex' });
    expect(props.input.data.params._meta).toEqual({
      callId: 'call_abc',
      threadId: 'thread-1',
      progressToken: 'p-1'
    });
    expect(JSON.stringify(props.input)).not.toContain('/home/dev/project');
  });

  it('passes the Codex call id on calls that do not wait for the response', async () => {
    let { sender, manager } = createClientCallSender();

    await sender.handleMessage(
      metaToolCall({ callId: 'call_sse', 'x-codex-turn-metadata': codexTurnMetadata }),
      { waitForResponse: false }
    );

    let props = (manager.callTool.mock.calls as any[][])[0]![0];
    expect(props.waitForResponse).toBe(false);
    expect(props.clientCall).toEqual({ id: 'call_sse', source: 'codex' });
    expect(props.input.data.params._meta).toEqual({ callId: 'call_sse' });
  });

  it('passes the Codex call id when the connection was initialized by Codex', async () => {
    let { sender, manager } = createClientCallSender({ clientName: 'codex-mcp-client' });

    await sender.handleMessage(metaToolCall({ callId: 'exec-1f2e' }), {
      waitForResponse: true
    });

    expect(manager.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ clientCall: { id: 'exec-1f2e', source: 'codex' } })
    );
  });

  it('does not pass a bare call id from a client that is not Codex', async () => {
    let { sender, manager } = createClientCallSender({ clientName: 'claude-code' });

    await sender.handleMessage(metaToolCall({ callId: 'call_abc' }), {
      waitForResponse: true
    });

    expect(manager.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ clientCall: null })
    );
  });

  it.each([
    ['too long', 'x'.repeat(257)],
    ['not a string', 12],
    ['a control character', 'toolu_\u0007']
  ])('ignores an id that is %s and still runs the call', async (_label, value) => {
    let { sender, manager } = createClientCallSender({ clientName: 'claude-code' });

    let res = await sender.handleMessage(metaToolCall({ 'claudecode/toolUseId': value }), {
      waitForResponse: true
    });

    expect(manager.callTool).toHaveBeenCalledOnce();
    expect(manager.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ clientCall: null })
    );
    expect(res?.mcp).toBeDefined();
  });

  it('stores a failed call without the turn metadata', async () => {
    let { sender, createMessage } = createClientCallSender({
      callTool: async () => {
        throw new Error('boom');
      }
    });

    await sender.handleMessage(
      metaToolCall({ callId: 'call_abc', 'x-codex-turn-metadata': codexTurnMetadata }),
      { waitForResponse: true }
    );

    let stored = createMessage.mock.calls[0]![0].input;
    expect(stored.data.params._meta).toEqual({ callId: 'call_abc' });
    expect(JSON.stringify(stored)).not.toContain('x-codex-turn-metadata');
  });

  it('strips the turn metadata from other requests', async () => {
    let { sender, manager } = createClientCallSender({ clientName: 'codex-mcp-client' });
    manager.callTool.mockResolvedValue({
      status: 'succeeded',
      message: null,
      output: { type: 'mcp', data: { jsonrpc: '2.0', id: 'x', result: { resources: [] } } }
    } as any);

    await sender.handleMessage(
      {
        jsonrpc: '2.0',
        id: 12,
        method: 'resources/list',
        params: { _meta: { progressToken: 2, 'x-codex-turn-metadata': codexTurnMetadata } }
      },
      { waitForResponse: true }
    );

    let props = (manager.callTool.mock.calls as any[][])[0]![0];
    expect(props.clientCall).toBeUndefined();
    expect(props.input.data.params._meta).toEqual({ progressToken: 2 });
    expect(manager.createMessage).toHaveBeenCalled();
    expect(
      JSON.stringify(manager.createMessage.mock.calls.map(([props]: any[]) => props.input))
    ).not.toContain('x-codex-turn-metadata');
  });
});
